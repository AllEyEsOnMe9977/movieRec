import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import {
  getLastRestoreState,
  isRestoreRunning,
  restoreLatestBackupFromS3,
} from '@/lib/s3-restore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOLDOWN_MS = 60_000; // Minimum 60 seconds between refresh checks
const WINDOW_MS = 15 * 60_000; // 15-minute sliding window
const MAX_REQUESTS_PER_WINDOW = 5;

let lastAttemptTimestamp = 0;
const ipRequestLog = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number; reason?: string } {
  const now = Date.now();

  // 1. Global cooldown check
  const elapsedSinceLast = now - lastAttemptTimestamp;
  if (elapsedSinceLast < COOLDOWN_MS) {
    const retryAfterSeconds = Math.ceil((COOLDOWN_MS - elapsedSinceLast) / 1000);
    return {
      allowed: false,
      retryAfterSeconds,
      reason: `Please wait ${retryAfterSeconds}s before checking for another backup.`,
    };
  }

  // 2. Per-IP sliding window check
  const recentTimestamps = (ipRequestLog.get(ip) || []).filter((ts) => now - ts < WINDOW_MS);
  if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = recentTimestamps[0];
    const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - oldestInWindow)) / 1000);
    ipRequestLog.set(ip, recentTimestamps);
    return {
      allowed: false,
      retryAfterSeconds,
      reason: `Rate limit exceeded (max ${MAX_REQUESTS_PER_WINDOW} checks per 15 minutes).`,
    };
  }

  recentTimestamps.push(now);
  ipRequestLog.set(ip, recentTimestamps);
  lastAttemptTimestamp = now;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function GET() {
  const lastState = await getLastRestoreState();
  const remainingCooldownSeconds = Math.max(
    0,
    Math.ceil((COOLDOWN_MS - (Date.now() - lastAttemptTimestamp)) / 1000)
  );

  return NextResponse.json({
    inProgress: isRestoreRunning(),
    remainingCooldownSeconds,
    lastRestore: lastState,
  });
}

export async function POST(req: NextRequest) {
  // Caution check 1: Require explicit confirmation header to block accidental triggers
  if (req.headers.get('x-confirm-restore') !== 'true') {
    return NextResponse.json(
      { error: 'Confirmation header (X-Confirm-Restore: true) is required.' },
      { status: 400 }
    );
  }

  // Caution check 2: Optional secret token protection if DB_REFRESH_SECRET is set in .env
  const requiredSecret = process.env.DB_REFRESH_SECRET;
  if (requiredSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${requiredSecret}`) {
      return NextResponse.json({ error: 'Unauthorized restore request.' }, { status: 401 });
    }
  }

  if (isRestoreRunning()) {
    return NextResponse.json(
      { error: 'A database restore is already running. Please wait for it to finish.' },
      { status: 409 }
    );
  }

  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: rateLimit.reason,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  try {
    const result = await restoreLatestBackupFromS3();

    if (result.status === 'restored') {
      revalidatePath('/', 'layout');
    }

    return NextResponse.json({
      ...result,
      cooldownSeconds: Math.ceil(COOLDOWN_MS / 1000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected database restore error.';
    if (message === 'RESTORE_IN_PROGRESS') {
      return NextResponse.json(
        { error: 'A database restore is already running.' },
        { status: 409 }
      );
    }
    console.error('[DB-RESTORE] API error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}