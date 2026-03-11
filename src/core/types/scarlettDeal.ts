/**
 * Scarlett CRM – TypeScript Types
 * 
 * Scarlett CRM is a WordPress-based CRM platform.
 * Data is exposed via the WordPress REST API:
 *   https://scarlettcrm.com/wp-json/
 *
 * Deals can come from:
 *  1. Custom post type: /wp/v2/deals
 *  2. wp-abilities plugin: /wp-abilities/v1/abilities/<name>/run
 */

/** Raw deal shape returned by the Scarlett CRM WordPress REST API */
export interface ScarlettRawDeal {
  id: number;
  slug?: string;
  status?: string;
  type?: string;
  link?: string;
  title?: {
    rendered: string;
  };
  content?: {
    rendered: string;
  };
  meta?: {
    deal_value?: string | number;
    deal_stage?: string;
    deal_status?: string;
    deal_probability?: string | number;
    expected_close_date?: string;
    tags?: string | string[];
    contact_name?: string;
    company_name?: string;
    owner?: string;
    pipeline_id?: string | number;
  };
  // ACF / Custom Fields (Advanced Custom Fields plugin)
  acf?: {
    deal_value?: string | number;
    deal_stage?: string;
    deal_status?: string;
    deal_probability?: string | number;
    expected_close_date?: string;
    tags?: string | string[];
    contact_name?: string;
    company_name?: string;
    owner?: string;
  };
  date?: string;
  modified?: string;
  _embedded?: Record<string, unknown>;
}

/** wp-abilities plugin deal shape (when using abilities endpoint) */
export interface ScarlettAbilityDeal {
  id: string | number;
  name?: string;
  title?: string;
  deal_name?: string;
  value?: string | number;
  deal_value?: string | number;
  stage?: string;
  deal_stage?: string;
  status?: string;
  deal_status?: string;
  probability?: string | number;
  close_date?: string;
  expected_close_date?: string;
  tags?: string | string[];
  owner?: string;
  company?: string;
  contact?: string;
  created_at?: string;
  updated_at?: string;
}

/** Normalized deal format used inside Summitly CRM */
export interface NormalizedScarlettDeal {
  key: string;
  DealName: string;
  Stage: string;
  DealValue: string;
  Tags: string;
  ExpectedCloseDate: string;
  Probability: string;
  Status: string;
  /** Applicant contact info extracted from Scarlett */
  Email?: string;
  Phone?: string;
  /** Mortgage-specific fields */
  PropertyAddress?: string;
  MortgageType?: string;
  LoanAmount?: string;
  ApplicationNumber?: string;
  BrokerName?: string;
  /** All applicant names on the deal */
  Applicants?: string[];
  /** Extra Scarlett-specific metadata (optional, for details page) */
  _source?: 'scarlett' | 'demo' | 'live';
  _raw?: ScarlettRawDeal | ScarlettAbilityDeal | Record<string, unknown>;
}

/** API response shape for /api/scarlett-deals */
export interface ScarlettDealsApiResponse {
  success: boolean;
  data: NormalizedScarlettDeal[];
  total: number;
  source: 'live' | 'fallback';
  endpoint?: string;
  error?: string;
}

/**
 * Normalised campaign record mapped from a Scarlett CRM WordPress blog post.
 * Shape mirrors campaignListData so it drops directly into the Campaign table.
 */
export interface ScarlettCampaignRecord {
  key: string;
  Name: string;         // Article title (truncated)
  Type: string;         // Always "Content Marketing"
  Progress1: string;    // Estimated Opened %
  Progress2: string;    // Estimated Closed %
  Progress3: string;    // Estimated Unsubscribe %
  Progress4: string;    // Estimated Delivered %
  Progress5: string;    // Estimated Conversation %
  Members: string;      // Author count
  Status: string;       // "Active" | "Success"
  /** Original article URL on scarlettcrm.com */
  _link?: string;
  /** Plain-text excerpt */
  _excerpt?: string;
  /** ISO publish date */
  _date?: string;
  _source: 'scarlett';
}

/** API response shape for /api/scarlett-articles */
export interface ScarlettArticlesApiResponse {
  success: boolean;
  data: ScarlettCampaignRecord[];
  total: number;
  source: 'live' | 'fallback';
  error?: string;
}
