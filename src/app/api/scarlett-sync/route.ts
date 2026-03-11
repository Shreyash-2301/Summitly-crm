/**
 * /api/scarlett-sync
 *
 * Triggered every hour by Vercel Cron (see vercel.json).
 * Can also be called manually:
 *   GET  /api/scarlett-sync          — runs sync, returns summary
 *   POST /api/scarlett-sync          — same
 *
 * Optional header for manual calls (bypasses the cron auth check):
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Returns detailed JSON including per-window logs so you can diagnose
 * exactly which windows succeeded / failed and why.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 5 minutes for full 2-year scan

import { NextRequest, NextResponse } from 'next/server';
import { syncScarlettDeals }         from '@/core/services/scarlettSyncService';

const CRON_SECRET = process.env.CRON_SECRET ?? '';

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  if (!CRON_SECRET) return true; // No secret configured → allow all (dev mode)
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${CRON_SECRET}`;
}

async function handler(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[/api/scarlett-sync] Sync triggered at', new Date().toISOString());

  const result = await syncScarlettDeals();

  return NextResponse.json(
    {
      ok:               result.runStatus !== 'failed',
      runStatus:        result.runStatus,
      windowsAttempted: result.windowsAttempted,
      windowsSucceeded: result.windowsSucceeded,
      dealsFound:       result.dealsFound,
      dealsUpserted:    result.dealsUpserted,
      durationMs:       result.durationMs,
      errors:           result.errors,
      // Full line-by-line log — very useful for debugging
      logs:             result.logs,
    },
    { status: result.runStatus === 'failed' ? 500 : 200 },
  );
}

export const GET  = handler;
export const POST = handler;
