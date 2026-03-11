export const dynamic = 'force-dynamic'

/**
 * API Route: /api/pipelines/[id]/stages/[stageId]/task-sets/[taskSetId]
 * Handles PUT (update assignment) and DELETE (remove task set from stage)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * PUT /api/pipelines/[id]/stages/[stageId]/task-sets/[taskSetId]
 * Update task set assignment to stage (order, isRequired, defaultDueDays)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string; taskSetId: string }> }
) {
  try {
    const { stageId, taskSetId } = await params;
    const body = await request.json();

    const { order, isRequired, defaultDueDays } = body;

    // Find the assignment
    const stageTaskSet = await prisma.pipelineStageTaskSet.findUnique({
      where: {
        stageId_taskSetId: {
          stageId,
          taskSetId,
        },
      },
    });

    if (!stageTaskSet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set assignment not found',
        },
        { status: 404 }
      );
    }

    // Update the assignment
    const updated = await prisma.pipelineStageTaskSet.update({
      where: {
        id: stageTaskSet.id,
      },
      data: {
        ...(order !== undefined && { order }),
        ...(isRequired !== undefined && { isRequired }),
        ...(defaultDueDays !== undefined && { defaultDueDays }),
      },
      include: {
        taskSet: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        stageId: updated.stageId,
        taskSetId: updated.taskSetId,
        order: updated.order,
        isRequired: updated.isRequired,
        defaultDueDays: updated.defaultDueDays,
      },
      message: 'Task set assignment updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating task set assignment:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update task set assignment',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pipelines/[id]/stages/[stageId]/task-sets/[taskSetId]
 * Remove task set from pipeline stage
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string; taskSetId: string }> }
) {
  try {
    const { stageId, taskSetId } = await params;

    // Find the assignment
    const stageTaskSet = await prisma.pipelineStageTaskSet.findUnique({
      where: {
        stageId_taskSetId: {
          stageId,
          taskSetId,
        },
      },
    });

    if (!stageTaskSet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set assignment not found',
        },
        { status: 404 }
      );
    }

    // Delete the assignment
    await prisma.pipelineStageTaskSet.delete({
      where: {
        id: stageTaskSet.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Task set removed from stage successfully',
    });
  } catch (error: any) {
    console.error('Error removing task set from stage:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to remove task set from stage',
      },
      { status: 500 }
    );
  }
}
