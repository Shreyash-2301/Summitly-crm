export const dynamic = 'force-dynamic'

/**
 * API Route: /api/pipelines/[id]/stages/[stageId]/task-sets
 * Handles GET (list task sets for stage) and POST (assign task set to stage)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/pipelines/[id]/stages/[stageId]/task-sets
 * Get all task sets assigned to a pipeline stage
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { stageId } = await params;

    // Verify stage exists
    const stage = await prisma.pipelineStage.findUnique({
      where: { id: stageId },
      include: {
        pipeline: true,
      },
    });

    if (!stage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pipeline stage not found',
        },
        { status: 404 }
      );
    }

    // Get task sets for this stage
    const stageTaskSets = await prisma.pipelineStageTaskSet.findMany({
      where: { stageId },
      include: {
        taskSet: {
          include: {
            templates: {
              include: {
                template: true,
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
      },
      orderBy: {
        order: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      data: stageTaskSets.map((sts) => ({
        id: sts.id,
        stageId: sts.stageId,
        taskSetId: sts.taskSetId,
        taskSet: {
          id: sts.taskSet.id,
          name: sts.taskSet.name,
          description: sts.taskSet.description,
          category: sts.taskSet.category,
          templates: sts.taskSet.templates.map((tst) => ({
            id: tst.template.id,
            name: tst.template.name,
            description: tst.template.description,
            category: tst.template.category,
            priority: tst.template.priority,
            isActive: tst.template.isActive,
          })),
        },
        order: sts.order,
        isRequired: sts.isRequired,
        defaultDueDays: sts.defaultDueDays,
        createdAt: sts.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching stage task sets:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch stage task sets',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipelines/[id]/stages/[stageId]/task-sets
 * Assign a task set to a pipeline stage
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { stageId } = await params;
    const body = await request.json();

    const { taskSetId, order, isRequired, defaultDueDays } = body;

    // Validate required fields
    if (!taskSetId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set ID is required',
        },
        { status: 400 }
      );
    }

    // Verify stage exists
    const stage = await prisma.pipelineStage.findUnique({
      where: { id: stageId },
    });

    if (!stage) {
      return NextResponse.json(
        {
          success: false,
          error: 'Pipeline stage not found',
        },
        { status: 404 }
      );
    }

    // Verify task set exists
    const taskSet = await prisma.taskSet.findUnique({
      where: { id: taskSetId },
    });

    if (!taskSet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set not found',
        },
        { status: 404 }
      );
    }

    // Check if already assigned
    const existing = await prisma.pipelineStageTaskSet.findUnique({
      where: {
        stageId_taskSetId: {
          stageId,
          taskSetId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set is already assigned to this stage',
        },
        { status: 409 }
      );
    }

    // Create the assignment
    const stageTaskSet = await prisma.pipelineStageTaskSet.create({
      data: {
        stageId,
        taskSetId,
        order: order ?? 0,
        isRequired: isRequired !== undefined ? isRequired : true,
        defaultDueDays: defaultDueDays ?? null,
      },
      include: {
        taskSet: {
          include: {
            templates: {
              include: {
                template: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: stageTaskSet.id,
        stageId: stageTaskSet.stageId,
        taskSetId: stageTaskSet.taskSetId,
        taskSet: {
          id: stageTaskSet.taskSet.id,
          name: stageTaskSet.taskSet.name,
          description: stageTaskSet.taskSet.description,
        },
        order: stageTaskSet.order,
        isRequired: stageTaskSet.isRequired,
        defaultDueDays: stageTaskSet.defaultDueDays,
        createdAt: stageTaskSet.createdAt.toISOString(),
      },
      message: 'Task set assigned to stage successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error assigning task set to stage:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set is already assigned to this stage',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to assign task set to stage',
      },
      { status: 500 }
    );
  }
}
