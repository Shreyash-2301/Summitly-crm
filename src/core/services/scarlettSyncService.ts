/**
 * Scarlett CRM → Database Sync Service
 *
 * Fetches ALL mortgage deals from Scarlett Network (DosConnect API) using
 * parallel 90-day windows going back 2 years (+7 days into the future for
 * pipeline deals with future close dates), then upserts every deal into the
 * local `scarlett_deals` table so the UI can serve fast DB reads instead of
 * hitting the external API on every page load.
 *
 * Called from:
 *   • /api/scarlett-sync  (GET / POST)  — HTTP trigger (Vercel Cron every hour)
 *   • scripts/sync-scarlett.mjs          — CLI: node scripts/sync-scarlett.mjs
 *
 * Detailed logging is written to `ScarlettSyncLog` in the database AND to
 * stdout so you can watch it in your terminal / Vercel function logs.
 */

import { prisma } from '@/core/database/prisma';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE     = process.env.SCARLETT_CRM_BASE_URL      ?? 'https://api.scarlettnetwork.com';
const API_KEY      = process.env.SCARLETT_DOSCONNECT_API_KEY ?? 'f07356191ee44a019d6a6b2cbd7ca2d3';
const WINDOW_DAYS  = 7;    // DosConnect max 7 days per request!
const WINDOWS_BACK = 104;  // 104 × 7 = 728 days ≈ 2 years of history
const TIMEOUT_MS   = 20_000;
const DELAY_MS     = 600;  // Delay between requests (API rate limit: 2/sec)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SyncResult {
  runStatus:        'success' | 'partial' | 'failed';
  windowsAttempted: number;
  windowsSucceeded: number;
  dealsFound:       number;
  dealsUpserted:    number;
  logs:             string[];
  errors:           string[];
  durationMs:       number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(d: Date) {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function ts() {
  return new Date().toISOString();
}

function log(lines: string[], level: 'INFO' | 'WARN' | 'ERROR', msg: string) {
  const line = `[${ts()}] [${level}] ${msg}`;
  lines.push(line);
  // Mirror to stdout so you can watch in terminal / Vercel logs
  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// ---------------------------------------------------------------------------
// DosConnect fetch — single window
// ---------------------------------------------------------------------------
async function fetchWindow(
  from: Date,
  to: Date,
  logLines: string[],
  errors: string[],
): Promise<any[] | null> {
  const fromStr = fmt(from);
  const toStr   = fmt(to);
  log(logLines, 'INFO', `  Fetching window ${fromStr} → ${toStr} …`);

  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${API_BASE}/dosconnect/deal-pull`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ APIKey: API_KEY, From: fromStr, To: toStr }),
      signal:  controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timer);

    log(logLines, 'INFO', `  Window ${fromStr}→${toStr} HTTP status: ${res.status}, content-type: ${res.headers.get('content-type')}`);

    // Read raw text first for debugging, then parse
    const rawText = await res.text();
    log(logLines, 'INFO', `  Window ${fromStr}→${toStr} raw body length: ${rawText.length} chars, preview: ${rawText.substring(0, 300)}`);

    if (!res.ok) {
      log(logLines, 'WARN', `  Window ${fromStr}→${toStr} HTTP ${res.status}: ${rawText.substring(0, 200)}`);
      errors.push(`HTTP ${res.status} for window ${fromStr}→${toStr}`);
      return null;
    }

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr: any) {
      log(logLines, 'ERROR', `  Window ${fromStr}→${toStr} JSON parse failed: ${parseErr?.message}`);
      errors.push(`JSON parse failed for ${fromStr}→${toStr}`);
      return null;
    }

    // Log the top-level keys to understand response structure
    const topKeys = data ? Object.keys(data) : [];
    log(logLines, 'INFO', `  Window ${fromStr}→${toStr} parsed keys: [${topKeys.join(', ')}]`);

    if (data?.Deals && Array.isArray(data.Deals)) {
      log(logLines, 'INFO', `  Window ${fromStr}→${toStr} → ${data.Deals.length} deal(s) returned`);
      return data.Deals;
    }

    // Some windows legitimately have 0 deals — not an error
    log(logLines, 'INFO', `  Window ${fromStr}→${toStr} → 0 deals (no Deals array found, typeof Deals: ${typeof data?.Deals})`);
    return [];
  } catch (err: any) {
    const msg = err?.name === 'AbortError'
      ? `Timed out after ${TIMEOUT_MS}ms`
      : (err instanceof Error ? err.message : String(err));
    log(logLines, 'WARN', `  Window ${fromStr}→${toStr} fetch failed: ${msg}`);
    errors.push(`Fetch failed for ${fromStr}→${toStr}: ${msg}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deal normalizer — same as scarlettCrmService but standalone
// ---------------------------------------------------------------------------
function normalize(raw: any) {
  const app        = raw?.MortgageApplication;
  const deal       = app?.MortgageDeal;
  const applicants = (raw?.ApplicantGroups?.[0]?.Applicants ?? []) as any[];
  const property   = raw?.SubjectProperty;

  // Borrower name
  const names = applicants
    .map((a: any) => `${a?.FirstName ?? ''} ${a?.LastName ?? ''}`.trim())
    .filter(Boolean);
  const dealName = names.join(' & ') || 'Unknown Borrower';

  // Deal value from property
  const propVal  = Number(property?.EstimatedValue ?? property?.PropertyValue ?? 0);
  const dealValue = propVal > 0
    ? `$${propVal.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
    : '$0';

  // Stage mapping
  const appStatus = app?.strMortgageApplicationStatus ?? 'Unknown';
  let stage = 'Qualify To Buy';
  const s = appStatus.toLowerCase();
  if (s.includes('work in progress') || s === 'active')        stage = 'Contact Made';
  if (s.includes('submitted') || s.includes('review'))         stage = 'Underwriting';
  if (s.includes('approved') || s.includes('conditional'))     stage = 'Final Approval';
  if (s.includes('closed') || s.includes('complete'))          stage = 'Closed Won';
  if (s.includes('cancelled') || s.includes('withdrawn'))      stage = 'Lost';

  // Key / application number
  const appNumber =
    deal?.ApplicationNumber ??
    app?.MortgageApplicationID?.toString() ??
    `deal-${Math.random().toString(36).slice(2)}`;

  // Contact info
  const primary  : any = applicants[0];
  const email    = primary?.Email ?? primary?.EmailAddress ?? primary?.email ?? '';
  const phone    = primary?.MobilePhone ?? primary?.HomePhone ?? primary?.Phone ?? primary?.CellPhone ?? '';

  // Applicant name list
  const applicantNames: string[] = applicants
    .map((a: any) => `${a?.FirstName ?? ''} ${a?.LastName ?? ''}`.trim())
    .filter(Boolean);

  // Property address
  const addrParts = [
    property?.StreetAddress ?? property?.Address ?? '',
    property?.City    ?? '',
    property?.Province ?? property?.State ?? '',
    property?.PostalCode ?? property?.ZipCode ?? '',
  ].filter(Boolean);
  const propertyAddress = addrParts.join(', ');

  // Mortgage details
  const mortgageType = deal?.strApplicationType ?? deal?.strDealPurpose ?? app?.strMortgageType ?? '';
  const rawLoan  = Number(
    app?.MortgageAmount ?? app?.LoanAmount ?? property?.PropertyMortgage?.MortgageAmount ?? 0,
  );
  const loanAmount = rawLoan > 0
    ? `$${rawLoan.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
    : '';
  const brokerName = app?.BrokerName ?? app?.AgentName ?? app?.AssignedTo ?? '';

  // Close date
  const closeDate = property?.PropertyMortgage?.ClosingDate
    ? new Date(property.PropertyMortgage.ClosingDate).toLocaleDateString('en-CA')
    : app?.SubmittedDate
    ? new Date(app.SubmittedDate).toLocaleDateString('en-CA')
    : '';

  // Probability
  const prob = s.includes('closed') || s.includes('complete') ? '100%'
    : s.includes('approved') ? '85%'
    : s.includes('submitted') ? '70%'
    : '50%';

  // Status
  const status = s.includes('cancelled') || s.includes('withdrawn') ? 'Lost' : 'Open';

  const tags = [deal?.ApplicationNumber ?? '', deal?.strDealPurpose ?? '', deal?.strApplicationType ?? '']
    .filter(Boolean).join(' | ');

  return {
    key:               appNumber,
    dealName,
    stage,
    dealValue,
    tags,
    expectedCloseDate: closeDate || null,
    probability:       prob,
    status,
    email:             email || null,
    phone:             phone || null,
    propertyAddress:   propertyAddress || null,
    mortgageType:      mortgageType || null,
    loanAmount:        loanAmount || null,
    applicationNumber: appNumber,
    brokerName:        brokerName || null,
    applicants:        applicantNames,
    rawData:           raw,
  };
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------
export async function syncScarlettDeals(): Promise<SyncResult> {
  const startedAt  = new Date();
  const logLines:  string[] = [];
  const errors:    string[] = [];

  log(logLines, 'INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(logLines, 'INFO', 'Scarlett CRM sync STARTED');
  log(logLines, 'INFO', `API base: ${API_BASE}`);
  log(logLines, 'INFO', `API key:  ${API_KEY ? API_KEY.slice(0, 8) + '…' : '(not set)'}`);

  // Create log record in DB so we can see it immediately (running status)
  let dbLog: { id: string } | null = null;
  try {
    dbLog = await prisma.scarlettSyncLog.create({
      data: { startedAt, runStatus: 'running', logs: [...logLines] },
    });
    log(logLines, 'INFO', `DB log record created: ${dbLog?.id ?? 'unknown'}`);
  } catch (e: any) {
    log(logLines, 'WARN', `Could not create DB log record: ${e?.message ?? e}`);
    errors.push(`DB log create failed: ${e?.message ?? e}`);
  }

  // -------------------------------------------------------------------------
  // Build time windows
  // -------------------------------------------------------------------------
  const now      = new Date();
  const windows: Array<[Date, Date]> = [];

  for (let q = 0; q < WINDOWS_BACK; q++) {
    const winTo   = new Date(now);
    winTo.setDate(winTo.getDate() - q * WINDOW_DAYS);

    const winFrom = new Date(winTo);
    winFrom.setDate(winFrom.getDate() - WINDOW_DAYS);

    windows.push([winFrom, winTo]);
  }

  // Add one future window (+7 days) to capture deals with upcoming close dates
  const futureWinFrom = new Date(now);
  const futureWinTo   = new Date(now);
  futureWinTo.setDate(futureWinTo.getDate() + 7);
  windows.unshift([futureWinFrom, futureWinTo]);

  log(logLines, 'INFO', `Fetching ${windows.length} windows sequentially (rate limit: 2 req/sec, early stop after 10 empty)…`);

  // -------------------------------------------------------------------------
  // Fetch windows SEQUENTIALLY with delay (API rate limit: 2/sec)
  // Stop early if we get many consecutive empty windows in the past
  // -------------------------------------------------------------------------
  const seenKeys  = new Set<string>();
  const rawDeals: any[] = [];
  let windowsSucceeded = 0;
  let windowsAttempted = 0;
  let consecutiveEmpty = 0;
  const MAX_CONSECUTIVE_EMPTY = 10; // Stop going further back after 10 empties in a row

  for (const [f, t] of windows) {
    windowsAttempted++;
    const result = await fetchWindow(f, t, logLines, errors);

    if (result !== null) {
      windowsSucceeded++;
      let foundInWindow = 0;
      for (const raw of result) {
        const key = raw?.MortgageApplication?.MortgageDeal?.ApplicationNumber
          ?? raw?.MortgageApplication?.MortgageApplicationID?.toString()
          ?? null;
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          rawDeals.push(raw);
          foundInWindow++;
        }
      }
      if (foundInWindow > 0) {
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty++;
      }
    } else {
      consecutiveEmpty++;
    }

    // Early termination — don't scan years back if there's nothing there
    // Only apply after we're past the first window (future window)
    if (windowsAttempted > 1 && consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
      log(logLines, 'INFO', `Early stop: ${MAX_CONSECUTIVE_EMPTY} consecutive empty windows — no older deals expected`);
      break;
    }

    // Wait between requests to stay under 2 req/sec
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  log(logLines, 'INFO', `Windows attempted: ${windowsAttempted} / ${windows.length}`);
  log(logLines, 'INFO', `Windows succeeded: ${windowsSucceeded} / ${windowsAttempted}`);
  log(logLines, 'INFO', `Unique deals collected: ${rawDeals.length}`);

  if (rawDeals.length === 0) {
    log(logLines, 'ERROR', 'No deals returned from any window — aborting upsert');
    errors.push('Zero deals returned; check API key and network connectivity');

    const durationMs = Date.now() - startedAt.getTime();
    const result: SyncResult = {
      runStatus:        'failed',
      windowsAttempted,
      windowsSucceeded,
      dealsFound:       0,
      dealsUpserted:    0,
      logs:             logLines,
      errors,
      durationMs,
    };

    if (dbLog) {
      await prisma.scarlettSyncLog.update({
        where: { id: dbLog.id },
        data: { completedAt: new Date(), runStatus: 'failed', logs: logLines, errors, windowsAttempted, windowsSucceeded, dealsFound: 0, dealsUpserted: 0 },
      }).catch(() => {/* swallow */});
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Upsert deals into DB — one by one so we get per-deal logging
  // -------------------------------------------------------------------------
  log(logLines, 'INFO', 'Beginning upsert phase…');

  let upserted = 0;
  let failed   = 0;

  for (const raw of rawDeals) {
    let normalized: ReturnType<typeof normalize>;
    try {
      normalized = normalize(raw);
    } catch (normalizeErr: any) {
      const msg = `Normalize error: ${normalizeErr?.message ?? normalizeErr}`;
      log(logLines, 'WARN', msg);
      errors.push(msg);
      failed++;
      continue;
    }

    try {
      await prisma.scarlettDeal.upsert({
        where:  { key: normalized.key },
        create: { ...normalized, syncedAt: new Date() },
        update: { ...normalized, syncedAt: new Date() },
      });
      log(logLines, 'INFO', `  [UPSERT OK] ${normalized.key} — ${normalized.dealName}`);
      upserted++;
    } catch (dbErr: any) {
      const msg = `DB upsert failed for key ${normalized.key} (${normalized.dealName}): ${dbErr?.message ?? dbErr}`;
      log(logLines, 'ERROR', msg);
      errors.push(msg);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // Finish
  // -------------------------------------------------------------------------
  const durationMs   = Date.now() - startedAt.getTime();
  const runStatus: SyncResult['runStatus'] =
    failed > 0 && upserted === 0 ? 'failed'
    : failed > 0                 ? 'partial'
    :                              'success';

  log(logLines, 'INFO', `Upsert complete — ${upserted} OK, ${failed} failed`);
  log(logLines, 'INFO', `Total duration: ${durationMs}ms`);
  log(logLines, 'INFO', `Final status: ${runStatus.toUpperCase()}`);
  log(logLines, 'INFO', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const result: SyncResult = {
    runStatus,
    windowsAttempted,
    windowsSucceeded,
    dealsFound:  rawDeals.length,
    dealsUpserted: upserted,
    logs:   logLines,
    errors,
    durationMs,
  };

  // Update DB log record
  if (dbLog) {
    await prisma.scarlettSyncLog.update({
      where: { id: dbLog.id },
      data: {
        completedAt:      new Date(),
        runStatus,
        windowsAttempted,
        windowsSucceeded,
        dealsFound:       rawDeals.length,
        dealsUpserted:    upserted,
        logs:             logLines,
        errors,
      },
    }).catch((e: any) => console.error('[ScarlettSync] Cannot update DB log:', e?.message));
  }

  return result;
}
