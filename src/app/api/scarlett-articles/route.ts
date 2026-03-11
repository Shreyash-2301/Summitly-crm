export const dynamic = 'force-dynamic'

/**
 * API Route: /api/scarlett-articles
 *
 * Fetches blog posts from the Scarlett CRM WordPress site and returns them
 * normalised as campaign-style records so the Campaign section can render
 * live content from Scarlett.
 *
 * The Scarlett CRM WordPress REST API exposes blog posts publicly (no auth):
 *   GET https://scarlettcrm.com/wp-json/wp/v2/posts?per_page=20
 *
 * Usage:
 *   GET /api/scarlett-articles              → all posts as campaigns
 *   GET /api/scarlett-articles?limit=5      → first 5 posts
 *   GET /api/scarlett-articles?search=crm   → filtered by title/excerpt
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchScarlettArticles } from '@/core/services/scarlettCrmService';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.toLowerCase() ?? '';
  const limit  = parseInt(searchParams.get('limit')  || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const result = await fetchScarlettArticles();
    const articles = result.articles || [];

    let filtered = articles as any[];

    if (search && articles.length > 0) {
      filtered = articles.filter(
        (a: any) =>
          (a.Name || '').toLowerCase().includes(search) ||
          (a.Type || '').toLowerCase().includes(search) ||
          (a._excerpt ?? '').toLowerCase().includes(search),
      );
    }

    // Apply pagination after filtering
    filtered = filtered.slice(offset, offset + limit);

    const total = filtered.length;

    return NextResponse.json({
      success: true,
      data:    filtered,
      total,
      limit,
      offset,
      source:  result.source,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/scarlett-articles] Error:', msg);

    return NextResponse.json(
      {
        success: false,
        data:    [],
        total:   0,
        limit,
        offset,
        source:  'fallback',
        error:   msg,
      },
      { status: 500 },
    );
  }
}
