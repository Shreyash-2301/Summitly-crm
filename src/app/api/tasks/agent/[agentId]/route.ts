export const dynamic = 'force-dynamic'

/**
 * API Route: /api/tasks/agent/[agentId]
 * Handles GET operations for tasks assigned to a specific agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// GET - Get all tasks for an agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const isCompleted = searchParams.get('isCompleted');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {
      agentId,
    };

    if (status) {
      where.status = status;
    }

    if (isCompleted !== null && isCompleted !== undefined) {
      where.isCompleted = isCompleted === 'true';
    }

    // Get tasks and count
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [
          { isCompleted: 'asc' }, // Incomplete tasks first
          { createdAt: 'desc' },
        ],
        include: {
          template: true,
        },
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: tasks,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching agent tasks:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch agent tasks',
      },
      { status: 500 }
    );
  }
}
