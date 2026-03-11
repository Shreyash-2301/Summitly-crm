/**
 * /api/scarlett-sync/logs
 *
 * Returns recent Scarlett sync log entries so you can diagnose failures
 * from the browser (or via curl).
 *
 * GET /api/scarlett-sync/logs?limit=10   — last N runs
 * GET /api/scarlett-sync/logs?id=<uuid>  — single run detail (full log lines)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id    = searchParams.get('id') ?? '';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);

  try {
    if (id) {
      // Single run — return everything including full log lines
      const entry = await prisma.scarlettSyncLog.findUnique({ where: { id } });
      if (!entry) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: entry });
    }

    // Summary list — omit the verbose `logs` array to keep response small
    const entries = await prisma.scarlettSyncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take:    limit,
      select: {
        id:               true,
        startedAt:        true,
        completedAt:      true,
        runStatus:        true,
        windowsAttempted: true,
        windowsSucceeded: true,
        dealsFound:       true,
        dealsUpserted:    true,
        errors:           true,
        // Last 5 log lines are enough for the summary view
        logs:             true,
      },
    });

    return NextResponse.json({ success: true, data: entries, total: entries.length });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}
