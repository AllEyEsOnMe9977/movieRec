/**
 * dbsync.js
 * ---------------------------------------------------------------------------
 * Purpose:
 *   Fetches the most recent .sql.gz backup from a Hetzner S3-compatible bucket
 *   (path: db-backups/) and imports it into the local MySQL database.
 *
 * Usage:
 *   node scripts/dbsync.js
 *
 * Requirements:
 *   - Node.js 18+
 *   - `mysql` CLI available in PATH (comes with MySQL/MariaDB client tools)
 *   - npm package: @aws-sdk/client-s3
 *   - .env file in project root (see .env.example below)
 * ---------------------------------------------------------------------------
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, createReadStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Simple timestamped logger (keeps console output consistent & greppable)
// ---------------------------------------------------------------------------
const log = {
  info: (msg) => console.log(`[${new Date().toISOString()}] [INFO]  ${msg}`),
  warn: (msg) => console.warn(`[${new Date().toISOString()}] [WARN]  ${msg}`),
  error: (msg) => console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`),
};

// ---------------------------------------------------------------------------
// Config — pulled from .env (see .env.example for required keys)
// ---------------------------------------------------------------------------
const config = {
  s3: {
    endpoint: process.env.S3_ENDPOINT,           // e.g. https://fsn1.your-objectstorage.com
    region: process.env.S3_REGION || 'us-east-1', // Hetzner ignores this but SDK requires it
    bucket: process.env.S3_BUCKET,                // e.g. your-bucket-name
    prefix: process.env.S3_BACKUP_PREFIX || 'db-backups/',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '3306',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  tempDir: path.join(os.tmpdir(), 'db-backup-sync'),
};

// ---------------------------------------------------------------------------
// Validate required env vars up front — fail fast with a clear message
// ---------------------------------------------------------------------------
function validateConfig() {
  const required = {
    S3_ENDPOINT: config.s3.endpoint,
    S3_BUCKET: config.s3.bucket,
    S3_ACCESS_KEY_ID: config.s3.accessKeyId,
    S3_SECRET_ACCESS_KEY: config.s3.secretAccessKey,
    DB_USER: config.mysql.user,
    DB_PASSWORD: config.mysql.password,
    DB_NAME: config.mysql.database,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing required .env variables: ${missing.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Find the most recently modified .sql.gz object under the backup prefix
// ---------------------------------------------------------------------------
async function findLatestBackupKey(s3Client) {
  log.info(`Listing objects in s3://${config.s3.bucket}/${config.s3.prefix}`);

  const command = new ListObjectsV2Command({
    Bucket: config.s3.bucket,
    Prefix: config.s3.prefix,
  });

  const response = await s3Client.send(command);
  const objects = (response.Contents || []).filter((obj) => obj.Key.endsWith('.sql.gz'));

  if (objects.length === 0) {
    throw new Error(`No .sql.gz backups found under prefix "${config.s3.prefix}"`);
  }

  // Sort by LastModified descending — newest first
  objects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

  const latest = objects[0];
  log.info(`Latest backup found: ${latest.Key} (Last modified: ${latest.LastModified.toISOString()})`);
  return latest.Key;
}

// ---------------------------------------------------------------------------
// Download the .sql.gz object to a local temp path
// ---------------------------------------------------------------------------
async function downloadBackup(s3Client, key, destPath) {
  log.info(`Downloading ${key} to ${destPath}`);

  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });

  const response = await s3Client.send(command);
  await pipeline(response.Body, createWriteStream(destPath));

  log.info('Download complete');
}

// ---------------------------------------------------------------------------
// MariaDB -> MySQL compatibility: MySQL rejects literal DEFAULT values on
// TEXT/BLOB/JSON columns (error 1101). We strip them from CREATE TABLE column
// definitions. Safe because mysqldump INSERTs always list every column value.
// ---------------------------------------------------------------------------
const BLOB_COLUMN_RE = /^\s+`[^`]+`\s+(?:(?:tiny|medium|long)?text|(?:tiny|medium|long)?blob|json)\b/i;
const DEFAULT_CLAUSE_RE = /\s+DEFAULT\s+(?!NULL\b)(?:'(?:[^'\\]|\\.|'')*'|\([^)]*\)|[^\s,]+)/i;
let strippedDefaults = 0;

function fixLine(line) {
  // Cheap pre-check: only indented column-definition lines can match
  if (line.charCodeAt(0) !== 32 || !BLOB_COLUMN_RE.test(line)) return line;
  const fixed = line.replace(DEFAULT_CLAUSE_RE, '');
  if (fixed !== line) {
    strippedDefaults++;
    log.warn(`Stripped unsupported default: ${line.trim()}`);
  }
  return fixed;
}

// Async generator used as a pipeline stage: processes the SQL stream line by
// line, carrying partial lines across chunk boundaries.
async function* stripBlobDefaults(source) {
  const decoder = new TextDecoder('utf-8');
  let leftover = '';
  for await (const chunk of source) {
    const lines = (leftover + decoder.decode(chunk, { stream: true })).split('\n');
    leftover = lines.pop(); // last element may be an incomplete line
    if (lines.length > 0) yield lines.map(fixLine).join('\n') + '\n';
  }
  const rest = leftover + decoder.decode();
  if (rest) yield fixLine(rest);
}

// ---------------------------------------------------------------------------
// Decompress the .sql.gz file into a plain .sql file (with compatibility fix)
// ---------------------------------------------------------------------------
async function decompressBackup(gzPath, sqlPath) {
  log.info(`Decompressing ${gzPath} -> ${sqlPath}`);
  await pipeline(
    createReadStream(gzPath),
    createGunzip(),
    stripBlobDefaults,
    createWriteStream(sqlPath)
  );
  log.info(`Decompression complete (removed ${strippedDefaults} incompatible default(s))`);
}

// ---------------------------------------------------------------------------
// Import the .sql file into MySQL using the `mysql` CLI
// (Uses spawn + stdin piping so we never expose the password via argv/ps)
// ---------------------------------------------------------------------------
function importIntoMysql(sqlPath) {
  return new Promise((resolve, reject) => {
    log.info(`Importing ${sqlPath} into database "${config.mysql.database}"`);

    const args = [
      '-h', config.mysql.host,
      '-P', config.mysql.port,
      '-u', config.mysql.user,
      config.mysql.database,
    ];

    // Password passed via env var (MYSQL_PWD) instead of CLI arg — avoids
    // exposing it in process listings (e.g. `ps aux`).
    const child = spawn(process.env.MYSQL_CLI_PATH || 'mysql', args, {
      env: { ...process.env, MYSQL_PWD: config.mysql.password },
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    const readStream = createReadStream(sqlPath);
    readStream.pipe(child.stdin);
    // If mysql exits early (e.g. SQL error), writing to its stdin raises EPIPE.
    // Swallow it here: the real error is already printed by mysql and is
    // reported through the 'close' handler below (non-zero exit code).
    child.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') reject(err);
      else log.warn('mysql closed its input early (EPIPE) - see mysql error above');
    });
    readStream.on('error', (err) => {
      child.kill();
      reject(err);
    });

    child.on('error', (err) => {
      // Typically ENOENT if `mysql` CLI isn't installed / not in PATH
      reject(new Error(`Failed to start mysql CLI: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        log.info('MySQL import completed successfully');
        resolve();
      } else {
        reject(new Error(`mysql CLI exited with code ${code}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Cleanup temp files, ignoring errors (best-effort)
// ---------------------------------------------------------------------------
function cleanup(filePaths) {
  for (const filePath of filePaths) {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        log.info(`Cleaned up temp file: ${filePath}`);
      }
    } catch (err) {
      log.warn(`Could not delete temp file ${filePath}: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log.info('=== DB backup sync started ===');

  validateConfig();

  if (!existsSync(config.tempDir)) {
    mkdirSync(config.tempDir, { recursive: true });
  }

  const s3Client = new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
    forcePathStyle: true, // required for most S3-compatible providers (Hetzner included)
  });

  const latestKey = await findLatestBackupKey(s3Client);
  const fileName = path.basename(latestKey);
  const gzPath = path.join(config.tempDir, fileName);
  const sqlPath = gzPath.replace(/\.gz$/, '');

  try {
    await downloadBackup(s3Client, latestKey, gzPath);
    await decompressBackup(gzPath, sqlPath);
    await importIntoMysql(sqlPath);
    log.info('=== DB backup sync finished successfully ===');
  } finally {
    cleanup([gzPath, sqlPath]);
  }
}

main().catch((err) => {
  log.error(`Sync failed: ${err.message}`);
  process.exit(1);
});
