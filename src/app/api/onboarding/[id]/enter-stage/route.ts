export const dynamic = 'force-dynamic'

/**
 * API Route: /api/onboarding/[id]/enter-stage
 * Handles POST - Move agent to a specific stage and assign tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';
import { enterStage } from '@/core/utils/onboarding-stage-handler';

/**
 * POST /api/onboarding/[id]/enter-stage
 * Move agent to a specific stage and auto-assign tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();

    const { stageId, assignedBy } = body;

    // Validate required fields
    if (!stageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stage ID is required',
        },
        { status: 400 }
      );
    }

    // Verify agent onboarding exists
    const onboarding = await prisma.agentOnboarding.findUnique({
      where: { agentId },
      include: {
        agent: true,
      },
    });

    if (!onboarding) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent onboarding record not found',
        },
        { status: 404 }
      );
    }

    // Verify stage exists and belongs to the same pipeline
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

    // If agent is already in a pipeline, verify it's the same pipeline
    if (onboarding.pipelineId && onboarding.pipelineId !== stage.pipelineId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Stage belongs to a different pipeline',
        },
        { status: 400 }
      );
    }

    // Enter the stage (assigns tasks and updates onboarding)
    const result = await enterStage(agentId, stageId, assignedBy);

    // Update pipeline reference if not set
    if (!onboarding.pipelineId) {
      await prisma.agentOnboarding.update({
        where: { agentId },
        data: {
          pipelineId: stage.pipelineId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        stageId,
        stageName: stage.name,
        tasksCreated: result.tasksCreated,
        pipelineId: stage.pipelineId,
      },
      message: `Agent entered stage "${stage.name}" and ${result.tasksCreated} tasks were assigned`,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error entering stage:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to enter stage',
      },
      { status: 500 }
    );
  }
}
