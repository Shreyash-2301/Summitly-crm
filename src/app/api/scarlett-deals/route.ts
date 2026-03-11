export const dynamic = 'force-dynamic';

/**
 * /api/scarlett-deals
 *
 * Serves mortgage deal data from the LOCAL DATABASE (scarlett_deals table).
 * Data is populated / refreshed by the hourly sync job at /api/scarlett-sync.
 *
 * Query params:
 *   search=<text>   — case-insensitive filter on dealName / stage / status / email
 *   status=<text>   — exact status match (case-insensitive)
 *   key=<text>      — exact key match (single-deal detail page)
 *   stage=<text>    — exact stage match (case-insensitive)
 *   grouped=true    — return per-stage groups with counts (for kanban)
 *   limit=<n>       — default 100, max 500 (per stage when grouped)
 *   offset=<n>      — default 0
 *
 * Returns:
 *   { success, data: NormalizedScarlettDeal[], total, source, lastSync }
 *   OR when grouped=true:
 *   { success, groups: { [stage]: { total, cards: NormalizedScarlettDeal[] } }, source, ... }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';
import type { NormalizedScarlettDeal } from '@/core/types/scarlettDeal';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search  = searchParams.get('search')?.toLowerCase() ?? '';
  const status  = searchParams.get('status') ?? '';
  const key     = searchParams.get('key')    ?? '';
  const stage   = searchParams.get('stage')  ?? '';
  const grouped = searchParams.get('grouped') === 'true';
  const limit   = Math.min(parseInt(searchParams.get('limit')  || '100'), 500);
  const offset  = parseInt(searchParams.get('offset') || '0');

  // Helper to map a DB row → NormalizedScarlettDeal
  function mapRow(row: any): NormalizedScarlettDeal {
    return {
      key:               row.key,
      DealName:          row.dealName,
      Stage:             row.stage,
      DealValue:         row.dealValue,
      Tags:              row.tags,
      ExpectedCloseDate: row.expectedCloseDate ?? '—',
      Probability:       row.probability,
      Status:            row.status,
      Email:             row.email             ?? undefined,
      Phone:             row.phone             ?? undefined,
      PropertyAddress:   row.propertyAddress   ?? undefined,
      MortgageType:      row.mortgageType       ?? undefined,
      LoanAmount:        row.loanAmount         ?? undefined,
      ApplicationNumber: row.applicationNumber  ?? undefined,
      BrokerName:        row.brokerName         ?? undefined,
      Applicants:        row.applicants         ?? [],
      _source: 'scarlett',
      _raw:    (row.rawData ?? undefined) as any,
    };
  }

  try {
    // -----------------------------------------------------------------------
    // 0. Grouped mode — return per-stage counts + first N cards per stage
    // -----------------------------------------------------------------------
    if (grouped) {
      const ALL_STAGES = [
        'New',
        'Work in Progress',
        'Submitted',
        'Compliance Review',
        'Approved',
        'Ready to Close',
        'Closed / Funded',
        'Paid & Finalized',
        'Renewed',
        'Cancelled',
        'Declined',
      ];

      const searchWhere = search
        ? {
            OR: [
              { dealName:        { contains: search, mode: 'insensitive' as const } },
              { email:           { contains: search, mode: 'insensitive' as const } },
              { propertyAddress: { contains: search, mode: 'insensitive' as const } },
              { brokerName:      { contains: search, mode: 'insensitive' as const } },
              { key:             { contains: search, mode: 'insensitive' as const } },
              { tags:            { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const perStageLimit = Math.min(limit, 100); // max 100 cards per stage column
      const stageResults = await Promise.all(
        ALL_STAGES.map(async (s) => {
          const where = { stage: s, ...searchWhere };
          const [rows, total] = await Promise.all([
            prisma.scarlettDeal.findMany({ where, orderBy: { syncedAt: 'desc' }, take: perStageLimit }),
            prisma.scarlettDeal.count({ where }),
          ]);
          return { stage: s, total, cards: rows.map(mapRow) };
        })
      );

      const groups: Record<string, { total: number; cards: NormalizedScarlettDeal[] }> = {};
      let grandTotal = 0;
      stageResults.forEach(({ stage: s, total, cards }) => {
        groups[s] = { total, cards };
        grandTotal += total;
      });

      const dbTotal   = await prisma.scarlettDeal.count();
      const source    = dbTotal > 0 ? 'live' : 'fallback';
      const latestSync = await prisma.scarlettSyncLog.findFirst({
        where:   { runStatus: { in: ['success', 'partial'] } },
        orderBy: { completedAt: 'desc' },
        select:  { completedAt: true, dealsUpserted: true, runStatus: true },
      });

      return NextResponse.json({
        success: true,
        groups,
        grandTotal,
        source,
        dbTotal,
        lastSync:       latestSync?.completedAt   ?? null,
        lastSyncStatus: latestSync?.runStatus      ?? null,
        lastSyncDeals:  latestSync?.dealsUpserted  ?? null,
      });
    }

    // -----------------------------------------------------------------------
    // 1. Build Prisma where clause (normal mode)
    // -----------------------------------------------------------------------
    const where: Record<string, any> = {};

    if (key)    where.key    = key;
    if (status) where.status = { equals: status, mode: 'insensitive' };
    if (stage)  where.stage  = { equals: stage,  mode: 'insensitive' };

    if (search) {
      where.OR = [
        { dealName:        { contains: search, mode: 'insensitive' } },
        { stage:           { contains: search, mode: 'insensitive' } },
        { status:          { contains: search, mode: 'insensitive' } },
        { email:           { contains: search, mode: 'insensitive' } },
        { propertyAddress: { contains: search, mode: 'insensitive' } },
        { brokerName:      { contains: search, mode: 'insensitive' } },
        { key:             { contains: search, mode: 'insensitive' } },
        { tags:            { contains: search, mode: 'insensitive' } },
      ];
    }

    // -----------------------------------------------------------------------
    // 2. Query DB
    // -----------------------------------------------------------------------
    const rows = await prisma.scarlettDeal.findMany({
      where,
      orderBy: { syncedAt: 'desc' },
      take:    limit,
      skip:    offset,
    });
    const total = await prisma.scarlettDeal.count({ where });

    // -----------------------------------------------------------------------
    // 3. Map DB rows → NormalizedScarlettDeal
    // -----------------------------------------------------------------------
    const data: NormalizedScarlettDeal[] = rows.map(mapRow);

    // -----------------------------------------------------------------------
    // 4. Determine source label & last sync info
    // -----------------------------------------------------------------------
    const dbTotal = await prisma.scarlettDeal.count();
    const source  = dbTotal > 0 ? 'live' : 'fallback';

    const latestSync = await prisma.scarlettSyncLog.findFirst({
      where:   { runStatus: { in: ['success', 'partial'] } },
      orderBy: { completedAt: 'desc' },
      select:  { completedAt: true, dealsUpserted: true, runStatus: true },
    });

    return NextResponse.json({
      success: true,
      data,
      total,
      limit,
      offset,
      source,
      dbTotal,
      lastSync:       latestSync?.completedAt    ?? null,
      lastSyncStatus: latestSync?.runStatus      ?? null,
      lastSyncDeals:  latestSync?.dealsUpserted  ?? null,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/scarlett-deals] DB error:', msg);

    return NextResponse.json(
      {
        success: false,
        data:    [],
        total:   0,
        source:  'fallback',
        error:   msg,
        hint:    'Database may not be set up yet. Run GET /api/scarlett-sync to populate.',
      },
      { status: 500 },
    );
  }
}
