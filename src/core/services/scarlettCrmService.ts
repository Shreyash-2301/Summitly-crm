/**
 * Scarlett Network Mortgage CRM API Service
 *
 * Platform: Scarlett Network - Mortgage CRM
 * URL: https://mortgage.scarlettnetwork.com
 * API Server: https://api.scarlettnetwork.com
 * 
 * Authentication Model:
 *   1. Login: POST /v1/auth/GetAccessTokenByUserName with {LoginName, Password, LanguageID}
 *   2. Response contains AccessToken
 *   3. Use Bearer token in Authorization header for all subsequent requests
 *
 * Main API Endpoints:
 *   - /v1/crm/dd/GetDeals        (Mortgage deals/loans)
 *   - /v1/crm/dd/GetApplicants   (Borrowers/applicants)
 *   - /v1/crm/activity/GetActivities (Calls, emails, tasks, meetings)
 *   - /v1/leadopportunities/leads/loadDD (New mortgage leads)
 */

import type {
  NormalizedScarlettDeal,
  ScarlettDealsApiResponse,
} from '../types/scarlettDeal';

import {
  MortgageDealsData,
  MortgageActivitiesData,
  MortgageApplicantsData,
  MortgageLeadsData,
} from '../json/mortgageDealsData';

const API_BASE_URL = process.env.SCARLETT_CRM_BASE_URL ?? 'https://api.scarlettnetwork.com';
const API_KEY = process.env.SCARLETT_CRM_API_KEY ?? '';
const USERNAME = process.env.SCARLETT_CRM_USERNAME ?? '';
const PASSWORD = process.env.SCARLETT_CRM_PASSWORD ?? '';
const DOSCONNECT_API_KEY = process.env.SCARLETT_DOSCONNECT_API_KEY ?? 'f07356191ee44a019d6a6b2cbd7ca2d3';

// Cache for session token
let cachedAccessToken: string | null = null;
let tokenExpiryTime: number = 0;

/**
 * Attempt to get a valid session AccessToken from Scarlett Network
 */
async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiryTime) {
    return cachedAccessToken;
  }

  if (!USERNAME || !PASSWORD) {
    console.warn('[Scarlett] No credentials configured, falling back to demo data');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/GetAccessTokenByUserName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        LoginName: USERNAME,
        Password: PASSWORD,
        LanguageID: 1,
      }),
      cache: 'no-store',
    } as RequestInit);

    if (!response.ok) {
      console.warn(`[Scarlett] Login failed (${response.status}), using demo data`);
      return null;
    }

    const data = await response.json() as any;

    if (data?.AccessToken) {
      cachedAccessToken = data.AccessToken;
      // Cache for 55 minutes (token typically expires at 60)
      tokenExpiryTime = Date.now() + 55 * 60 * 1000;
      console.log('[Scarlett] Successfully obtained session AccessToken');
      return cachedAccessToken;
    }

    console.warn('[Scarlett] No AccessToken in response, using demo data');
    return null;
  } catch (err) {
    console.warn('[Scarlett] Login request failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generic fetch with fallback auth
// ---------------------------------------------------------------------------

/**
 * Fetch deals from DosConnect endpoint (deal-pull)
 * Uses APIKey in JSON body with date range
 */
/** Helper: single DosConnect request for a specific date window */
async function dosConnectFetch(from: Date, to: Date): Promise<any[] | null> {
  const formatDate = (d: Date) => d.toISOString().split('T')[0];
  try {
    const response = await fetch(`${API_BASE_URL}/dosconnect/deal-pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ APIKey: DOSCONNECT_API_KEY, From: formatDate(from), To: formatDate(to) }),
      cache: 'no-store',
    } as RequestInit);
    if (!response.ok) return null;
    const data = await response.json() as any;
    if (data?.Deals && Array.isArray(data.Deals)) return data.Deals;
    return null;
  } catch {
    return null;
  }
}

export async function fetchScarlettDealsFromDosConnect(): Promise<ScarlettDealsApiResponse> {
  if (!DOSCONNECT_API_KEY) {
    console.warn('[Scarlett] No DosConnect API key configured, trying session auth...');
    return fetchScarlettDealsFromSession();
  }

  const to = new Date();
  const seenKeys = new Set<string>();
  const allDeals: any[] = [];

  // Fetch in quarterly windows going back 2 years (8 quarters × ~90 days each).
  // The DosConnect API rejects wide ranges, so we paginate by quarter.
  // Requests are made in parallel for speed.
  const windows: Array<[Date, Date]> = [];
  for (let q = 0; q < 8; q++) {
    const winTo = new Date(to);
    winTo.setDate(winTo.getDate() - q * 90);
    const winFrom = new Date(winTo);
    winFrom.setDate(winFrom.getDate() - 90);
    windows.push([winFrom, winTo]);
  }

  const results = await Promise.allSettled(windows.map(([f, t]) => dosConnectFetch(f, t)));

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      for (const d of r.value) {
        const normalized = normalizeScarletDealFromDosConnect(d);
        if (!seenKeys.has(normalized.key)) {
          seenKeys.add(normalized.key);
          allDeals.push(d);
        }
      }
    }
  }

  if (allDeals.length > 0) {
    console.log(`[Scarlett] Fetched ${allDeals.length} unique deals across quarterly windows`);
    return {
      success: true,
      data: allDeals.map((d) => normalizeScarletDealFromDosConnect(d)),
      total: allDeals.length,
      source: 'live',
      endpoint: '/dosconnect/deal-pull',
    };
  }

  console.warn('[Scarlett] All quarterly windows empty, falling back to session auth');
  return fetchScarlettDealsFromSession();
}

/**
 * Normalize DosConnect deal response
 */
function normalizeScarletDealFromDosConnect(raw: any): NormalizedScarlettDeal {
  const app = raw?.MortgageApplication;
  // MortgageDeal is nested inside MortgageApplication
  const deal = app?.MortgageDeal;
  const applicants = raw?.ApplicantGroups?.[0]?.Applicants || [];
  const property = raw?.SubjectProperty;

  // Build borrower name from applicants (they are plain objects, not strings)
  let borrowerName = 'Unknown';
  if (applicants.length > 0) {
    const names = applicants
      .map((a: any) => `${a?.FirstName || ''} ${a?.LastName || ''}`.trim())
      .filter((n: string) => n);
    borrowerName = names.join(' & ') || 'Unknown';
  }

  // Use subject property estimated value as the deal value
  const propertyValue = property?.EstimatedValue || property?.PropertyValue || 0;
  const dealValue = propertyValue > 0 ? `$${propertyValue.toLocaleString('en-CA', { maximumFractionDigits: 0 })}` : '$0';

  const appStatus = app?.strMortgageApplicationStatus || 'Unknown';
  let stage = 'Qualify To Buy';
  if (appStatus === 'New') stage = 'Qualify To Buy';
  if (appStatus.includes('Work in Progress') || appStatus === 'Active') stage = 'Contact Made';
  if (appStatus.includes('Submitted') || appStatus.includes('Review')) stage = 'Underwriting';
  if (appStatus.includes('Approved') || appStatus.includes('Conditional')) stage = 'Final Approval';
  if (appStatus.includes('Closed') || appStatus.includes('Complete')) stage = 'Closed Won';
  if (appStatus.includes('Cancelled') || appStatus.includes('Withdrawn')) stage = 'Lost';

  const appNumber = deal?.ApplicationNumber || app?.MortgageApplicationID?.toString() || Math.random().toString();

  // Extract contact info from applicants
  const primaryApplicant = applicants[0] as any;
  const email   = primaryApplicant?.Email || primaryApplicant?.EmailAddress || primaryApplicant?.email || '';
  const phone   = primaryApplicant?.MobilePhone || primaryApplicant?.HomePhone || primaryApplicant?.Phone || primaryApplicant?.CellPhone || '';
  const applicantNames: string[] = applicants
    .map((a: any) => `${a?.FirstName || ''} ${a?.LastName || ''}`.trim())
    .filter((n: string) => !!n);

  // Extract property address
  const propAddr = property?.Address || property?.StreetAddress
    ? [
        property?.StreetAddress || property?.Address || '',
        property?.City || '',
        property?.Province || property?.State || '',
        property?.PostalCode || property?.ZipCode || '',
      ].filter(Boolean).join(', ')
    : '';

  const mortgageType = deal?.strApplicationType || deal?.strDealPurpose || app?.strMortgageType || '';
  const loanAmount   = app?.MortgageAmount || app?.LoanAmount || property?.PropertyMortgage?.MortgageAmount
    ? `$${Number(app?.MortgageAmount || app?.LoanAmount || property?.PropertyMortgage?.MortgageAmount || 0).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
    : '';
  const brokerName   = app?.BrokerName || app?.AgentName || app?.AssignedTo || '';

  return {
    key: appNumber,
    DealName: borrowerName,
    Stage: stage,
    DealValue: dealValue,
    Tags: `${deal?.ApplicationNumber || ''} | ${deal?.strDealPurpose || ''} ${deal?.strApplicationType || ''}`.trim().replace(/^\|\s*/, ''),
    ExpectedCloseDate: property?.PropertyMortgage?.ClosingDate 
      ? new Date(property.PropertyMortgage.ClosingDate).toLocaleDateString('en-CA')
      : (app?.SubmittedDate ? new Date(app.SubmittedDate).toLocaleDateString('en-CA') : '—'),
    Probability: appStatus.includes('Closed') || appStatus.includes('Complete') ? '100%' : appStatus.includes('Approved') ? '85%' : appStatus.includes('Submitted') ? '70%' : '50%',
    Status: appStatus.includes('Cancelled') || appStatus.includes('Withdrawn') ? 'Lost' : 'Open',
    Email: email,
    Phone: phone,
    PropertyAddress: propAddr,
    MortgageType: mortgageType,
    LoanAmount: loanAmount,
    ApplicationNumber: appNumber,
    BrokerName: brokerName,
    Applicants: applicantNames,
    _source: 'scarlett',
    _raw: raw,
  };
}

/**
 * Fetch deals from session-authenticated endpoint (v1/crm/dd/GetDeals)
 */
async function fetchScarlettDealsFromSession(): Promise<ScarlettDealsApiResponse> {
  const token = await getAccessToken();

  if (token) {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/crm/dd/GetDeals`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ PageNum: 1, PageSize: 100 }),
        cache: 'no-store',
      } as RequestInit);

      if (response.ok) {
        const data = await response.json() as any;

        if (data?.Deals && Array.isArray(data.Deals) && data.Deals.length > 0) {
          console.log(`[Scarlett] Successfully fetched ${data.Deals.length} deals from session API`);
          return {
            success: true,
            data: data.Deals.map((d: any) => normalizeScarletDealFromDosConnect(d)),
            total: data.Deals.length,
            source: 'live',
            endpoint: '/v1/crm/dd/GetDeals',
          };
        }
      }
    } catch (err) {
      console.warn('[Scarlett] Session API fetch failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback to demo data
  return fetchDemoData();
}

/**
 * Get demo data fallback
 */
function fetchDemoData(): ScarlettDealsApiResponse {
  return {
    success: true,
    data: MortgageDealsData.map((d, idx) => ({
      key: d.key,
      DealName: d.DealName,
      Stage: d.Stage,
      DealValue: d.DealValue,
      Tags: d.Tags,
      ExpectedCloseDate: d.ExpectedCloseDate,
      Probability: d.Probability,
      Status: d.Status,
      _source: 'scarlett' as const,
      _raw: d as any,
    })),
    total: MortgageDealsData.length,
    source: 'fallback',
  };
}

/**
 * Get mortgage activities (calls, emails, tasks, meetings)
 */
export async function fetchScarlettActivities() {
  const token = await getAccessToken();

  if (token) {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/crm/activity/GetActivities`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: '{}',
        cache: 'no-store',
      } as RequestInit);

      if (response.ok) {
        const data = await response.json() as any;
        console.log('[Scarlett] Successfully fetched real activities from API');
        return {
          success: true,
          data: data?.activities || data?.data || [],
          total: (data?.activities || data?.data || []).length,
          source: 'live' as const,
        };
      }
    } catch (err) {
      console.warn('[Scarlett] Activities fetch failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback to demo
  return {
    success: true,
    data: MortgageActivitiesData,
    total: MortgageActivitiesData.length,
    source: 'fallback' as const,
  };
}

/**
 * Get mortgage applicants/borrowers
 */
export async function fetchScarlettApplicants() {
  const token = await getAccessToken();

  if (token) {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/crm/dd/GetApplicants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: '{}',
        cache: 'no-store',
      } as RequestInit);

      if (response.ok) {
        const data = await response.json() as any;
        console.log('[Scarlett] Successfully fetched real applicants from API');
        return {
          success: true,
          data: data?.applicants || data?.data || [],
          total: (data?.applicants || data?.data || []).length,
          source: 'live' as const,
        };
      }
    } catch (err) {
      console.warn('[Scarlett] Applicants fetch failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback to demo
  return {
    success: true,
    data: MortgageApplicantsData,
    total: MortgageApplicantsData.length,
    source: 'fallback' as const,
  };
}

/**
 * Get mortgage leads
 */
export async function fetchScarlettLeads() {
  const token = await getAccessToken();

  if (token) {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/leadopportunities/leads/loadDD`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: '{}',
        cache: 'no-store',
      } as RequestInit);

      if (response.ok) {
        const data = await response.json() as any;
        console.log('[Scarlett] Successfully fetched real leads from API');
        return {
          success: true,
          data: data?.leads || data?.data || [],
          total: (data?.leads || data?.data || []).length,
          source: 'live' as const,
        };
      }
    } catch (err) {
      console.warn('[Scarlett] Leads fetch failed:', err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback to demo
  return {
    success: true,
    data: MortgageLeadsData,
    total: MortgageLeadsData.length,
    source: 'fallback' as const,
  };
}

/**
 * Fetch Scarlett articles (for Campaign module) - kept for backward compatibility
 * This was originally fetching WordPress blog posts
 */
export async function fetchScarlettArticles() {
  // No longer supported - Scarlett Network is not WordPress-based
  // Return empty result for backward compatibility
  console.log('[Scarlett] Articles endpoint deprecated - Scarlett Network uses CRM deals, not blog posts');
  return {
    articles: [],
    source: 'fallback' as const,
  };
}
