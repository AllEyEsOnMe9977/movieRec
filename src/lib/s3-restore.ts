import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type _Object,
} from '@aws-sdk/client-s3';

export interface BackupMetadata {
  key: string;
  eTag: string;
  lastModified: string;
  size: number;
}

export interface RestoreState {
  backupKey: string;
  eTag: string;
  lastModified: string;
  restoredAt: string;
}

export type RestoreOutcome =
  | {
      status: 'restored';
      message: string;
      backup: BackupMetadata;
      durationMs: number;
    }
  | {
      status: 'ignored';
      message: string;
      backup: BackupMetadata;
      lastRestoredAt: string;
    };

const FALLBACK_STATE_FILE = path.join(os.tmpdir(), 'movierec-db-restore-state.json');

// In-process mutex to prevent overlapping restore runs
let restoreInFlight = false;

export function isRestoreRunning(): boolean {
  return restoreInFlight;
}

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'us-east-1';
  const bucket = process.env.S3_BUCKET;
  const prefix = process.env.S3_BACKUP_PREFIX || 'db-backups/';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing required S3 environment variables (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).');
  }

  const client = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket, prefix };
}

function getDbConfig() {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '3306';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !database) {
    throw new Error('Missing required database environment variables (DB_HOST, DB_USER, DB_NAME).');
  }

  // Only honor MYSQL_CLI_PATH if the binary actually exists on this OS (avoids Windows paths breaking Linux containers)
  const configuredCli = process.env.MYSQL_CLI_PATH;
  const cliBinary =
    configuredCli && fs.existsSync(configuredCli) ? configuredCli : 'mysql';

  return { host, port, user, password: password || '', database, cliBinary };
}

/**
 * Runs a short SQL command via the mysql CLI using MYSQL_PWD so credentials never appear in process arguments.
 */
async function runSqlQuery(sql: string): Promise<string> {
  const { host, port, user, password, database, cliBinary } = getDbConfig();

  return new Promise((resolve, reject) => {
    const child = spawn(
      cliBinary,
      ['-h', host, '-P', port, '-u', user, '-N', '-B', database, '-e', sql],
      {
        env: { ...process.env, MYSQL_PWD: password },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `mysql exited with code ${code}`));
      }
    });
  });
}

function escapeSqlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Reads the last applied backup state from MariaDB (_db_restore_state), falling back to /tmp JSON.
 */
export async function getLastRestoreState(): Promise<RestoreState | null> {
  try {
    const row = await runSqlQuery(
      'SELECT backup_key, etag, last_modified, restored_at FROM _db_restore_state WHERE id = 1 LIMIT 1;'
    );
    if (row) {
      const [backupKey, eTag, lastModified, restoredAt] = row.split('\t');
      if (backupKey && eTag) {
        return { backupKey, eTag, lastModified: lastModified || '', restoredAt: restoredAt || '' };
      }
    }
  } catch {
    // Table may not exist on first boot; fall through to local file cache
  }

  try {
    if (fs.existsSync(FALLBACK_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(FALLBACK_STATE_FILE, 'utf8')) as RestoreState;
    }
  } catch {
    // Ignore malformed cache file
  }

  return null;
}

/**
 * Saves the applied backup marker to both MariaDB (post-restore) and local tmp storage.
 */
async function saveRestoreState(state: RestoreState): Promise<void> {
  try {
    fs.writeFileSync(FALLBACK_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn('[DB-RESTORE] Failed to write local state file:', err);
  }

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS _db_restore_state (
      id TINYINT PRIMARY KEY,
      backup_key VARCHAR(512) NOT NULL,
      etag VARCHAR(128) NOT NULL,
      last_modified VARCHAR(64) NOT NULL,
      restored_at VARCHAR(64) NOT NULL
    );
  `;

  const upsertSql = `
    REPLACE INTO _db_restore_state (id, backup_key, etag, last_modified, restored_at)
    VALUES (
      1,
      '${escapeSqlString(state.backupKey)}',
      '${escapeSqlString(state.eTag)}',
      '${escapeSqlString(state.lastModified)}',
      '${escapeSqlString(state.restoredAt)}'
    );
  `;

  await runSqlQuery(`${createTableSql} ${upsertSql}`);
}

/**
 * Finds the most recent .sql or .sql.gz backup object under S3_BACKUP_PREFIX.
 */
export async function findLatestS3Backup(): Promise<BackupMetadata> {
  const { client, bucket, prefix } = getS3Config();
  const candidates: _Object[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (
          obj.Key &&
          (obj.Size ?? 0) > 0 &&
          (obj.Key.endsWith('.sql') || obj.Key.endsWith('.sql.gz'))
        ) {
          candidates.push(obj);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  if (candidates.length === 0) {
    throw new Error(`No .sql or .sql.gz backup files found in s3://${bucket}/${prefix}`);
  }

  candidates.sort((a, b) => {
    const timeA = a.LastModified ? a.LastModified.getTime() : 0;
    const timeB = b.LastModified ? b.LastModified.getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return (b.Key || '').localeCompare(a.Key || '');
  });

  const latest = candidates[0];
  return {
    key: latest.Key!,
    eTag: (latest.ETag || '').replace(/^"|"$/g, ''),
    lastModified: latest.LastModified ? latest.LastModified.toISOString() : new Date(0).toISOString(),
    size: latest.Size || 0,
  };
}

/**
 * Restores the latest S3 backup into MariaDB unless it matches the last applied update.
 */
export async function restoreLatestBackupFromS3(): Promise<RestoreOutcome> {
  if (restoreInFlight) {
    throw new Error('RESTORE_IN_PROGRESS');
  }

  restoreInFlight = true;
  const startedAt = Date.now();

  try {
    const latestBackup = await findLatestS3Backup();
    const lastState = await getLastRestoreState();

    // Ignore if the latest S3 object has already been restored
    if (
      lastState &&
      lastState.backupKey === latestBackup.key &&
      lastState.eTag !== '' &&
      lastState.eTag === latestBackup.eTag
    ) {
      console.info(
        `[DB-RESTORE] Ignored: already on latest backup (${latestBackup.key}, ETag=${latestBackup.eTag})`
      );
      return {
        status: 'ignored',
        message: 'Database is already up to date with the latest S3 backup.',
        backup: latestBackup,
        lastRestoredAt: lastState.restoredAt,
      };
    }

    console.info(`[DB-RESTORE] Downloading and restoring ${latestBackup.key}...`);

    const { client, bucket } = getS3Config();
    const { host, port, user, password, database, cliBinary } = getDbConfig();

    const objectResponse = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: latestBackup.key,
      })
    );

    if (!objectResponse.Body) {
      throw new Error(`S3 returned an empty stream for ${latestBackup.key}`);
    }

    const s3Readable =
      objectResponse.Body instanceof Readable
        ? objectResponse.Body
        : Readable.fromWeb(objectResponse.Body.transformToWebStream() as never);

    const mysqlProcess = spawn(
      cliBinary,
      ['-h', host, '-P', port, '-u', user, database],
      {
        env: { ...process.env, MYSQL_PWD: password },
        stdio: ['pipe', 'ignore', 'pipe'],
      }
    );

    let stderrOutput = '';
    mysqlProcess.stderr.on('data', (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    const exitPromise = new Promise<void>((resolve, reject) => {
      mysqlProcess.on('error', (err) => reject(err));
      mysqlProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderrOutput.trim() || `mysql restore failed with exit code ${code}`));
        }
      });
    });

    if (latestBackup.key.endsWith('.sql.gz')) {
      await pipeline(s3Readable, createGunzip(), mysqlProcess.stdin);
    } else {
      await pipeline(s3Readable, mysqlProcess.stdin);
    }

    await exitPromise;

    const restoredAt = new Date().toISOString();
    await saveRestoreState({
      backupKey: latestBackup.key,
      eTag: latestBackup.eTag,
      lastModified: latestBackup.lastModified,
      restoredAt,
    });

    const durationMs = Date.now() - startedAt;
    console.info(`[DB-RESTORE] Completed ${latestBackup.key} in ${durationMs}ms`);

    return {
      status: 'restored',
      message: 'Database successfully restored from the latest S3 backup.',
      backup: latestBackup,
      durationMs,
    };
  } finally {
    restoreInFlight = false;
  }
}