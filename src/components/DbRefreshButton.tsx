'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface RestoreState {
  backupKey: string;
  eTag: string;
  lastModified: string;
  restoredAt: string;
}

interface RefreshResult {
  type: 'restored' | 'ignored' | 'error';
  text: string;
  detail?: string;
}

const COOLDOWN_STORAGE_KEY = 'movierec_db_refresh_until';
const CONFIRM_KEYWORD = 'RESTORE';

export default function DbRefreshButton() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [lastRestore, setLastRestore] = useState<RestoreState | null>(null);
  const [feedback, setFeedback] = useState<RefreshResult | null>(null);

  const startCooldown = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    const until = Date.now() + seconds * 1000;
    try {
      localStorage.setItem(COOLDOWN_STORAGE_KEY, String(until));
    } catch {
      // Ignore storage errors in private browsing
    }
    setCooldownLeft(seconds);
  }, []);

  // Sync cooldown & last restore status on mount
  useEffect(() => {
    try {
      const savedUntil = Number(localStorage.getItem(COOLDOWN_STORAGE_KEY) || '0');
      if (savedUntil > Date.now()) {
        setCooldownLeft(Math.ceil((savedUntil - Date.now()) / 1000));
      }
    } catch {
      // Ignore storage errors
    }

    fetch('/api/db/refresh')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.lastRestore) setLastRestore(data.lastRestore);
        if (data.remainingCooldownSeconds > 0) {
          startCooldown(data.remainingCooldownSeconds);
        }
      })
      .catch(() => {});
  }, [startCooldown]);

  // Tick down active cooldown every second
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setInterval(() => {
      setCooldownLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownLeft]);

  const handleOpenModal = () => {
    setConfirmInput('');
    setIsModalOpen(true);
  };

  const handleConfirmRestore = async () => {
    if (confirmInput.trim().toUpperCase() !== CONFIRM_KEYWORD || isLoading || cooldownLeft > 0) {
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/db/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Confirm-Restore': 'true',
        },
      });

      const data = await response.json();

      if (response.status === 429) {
        const retryAfter = Number(data.retryAfterSeconds || 60);
        startCooldown(retryAfter);
        setFeedback({
          type: 'error',
          text: data.error || `Rate limited. Try again in ${retryAfter}s.`,
        });
        setIsModalOpen(false);
        return;
      }

      if (!response.ok) {
        setFeedback({
          type: 'error',
          text: data.error || 'Database restore failed.',
        });
        setIsModalOpen(false);
        return;
      }

      if (data.cooldownSeconds) {
        startCooldown(Number(data.cooldownSeconds));
      }

      if (data.status === 'ignored') {
        setFeedback({
          type: 'ignored',
          text: 'Ignored — already on the latest S3 backup.',
          detail: data.backup?.key,
        });
      } else {
        setLastRestore({
          backupKey: data.backup.key,
          eTag: data.backup.eTag,
          lastModified: data.backup.lastModified,
          restoredAt: new Date().toISOString(),
        });
        setFeedback({
          type: 'restored',
          text: `Database restored (${(data.durationMs / 1000).toFixed(1)}s).`,
          detail: data.backup?.key,
        });
        router.refresh();
      }

      setIsModalOpen(false);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error while restoring database.',
      });
      setIsModalOpen(false);
    } finally {
      setIsLoading(false);
      setConfirmInput('');
    }
  };

  const isDisabled = isLoading || cooldownLeft > 0;
  const isConfirmed = confirmInput.trim().toUpperCase() === CONFIRM_KEYWORD;

  return (
    <div className="inline-flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={isDisabled}
        title={
          cooldownLeft > 0
            ? `Rate limit active — wait ${cooldownLeft}s`
            : 'Check S3 bucket and restore latest database backup'
        }
        className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        {isLoading
          ? 'Restoring DB...'
          : cooldownLeft > 0
            ? `Sync DB (${cooldownLeft}s)`
            : 'Sync DB from S3'}
      </button>

      {feedback && (
        <div
          role="status"
          className={`max-w-xs rounded-md border px-2.5 py-1 text-right text-xs ${
            feedback.type === 'restored'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : feedback.type === 'ignored'
                ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}
        >
          <p className="font-medium">{feedback.text}</p>
          {feedback.detail && (
            <p className="truncate font-mono text-[11px] opacity-80">{feedback.detail}</p>
          )}
        </div>
      )}

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="db-restore-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-left text-zinc-100 shadow-2xl">
            <h2 id="db-restore-title" className="text-base font-semibold text-amber-300">
              Caution: Restore Database from S3
            </h2>

            <p className="mt-2 text-sm text-zinc-300">
              This will check your S3 backup bucket and overwrite existing MariaDB tables with the
              latest SQL dump. If the database already matches the latest S3 backup, the restore
              will be skipped automatically.
            </p>

            {lastRestore && (
              <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5 text-xs text-zinc-400">
                <div>
                  <span className="text-zinc-500">Current backup:</span>{' '}
                  <span className="font-mono text-zinc-200">{lastRestore.backupKey}</span>
                </div>
                <div className="mt-0.5">
                  <span className="text-zinc-500">Applied at:</span>{' '}
                  {new Date(lastRestore.restoredAt).toLocaleString()}
                </div>
              </div>
            )}

            <label className="mt-4 block text-xs font-medium text-zinc-300">
              Type <span className="font-mono font-bold text-amber-300">{CONFIRM_KEYWORD}</span> to
              proceed:
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={CONFIRM_KEYWORD}
                autoFocus
                className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-amber-400"
              />
            </label>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isLoading}
                className="rounded-lg border border-zinc-700 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={!isConfirmed || isLoading}
                className="rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLoading ? 'Restoring...' : 'Confirm & Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}