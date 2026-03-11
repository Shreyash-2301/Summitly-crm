export const dynamic = 'force-dynamic'

/**
 * API Route: /api/onboarding/[id]/complete-stage
 * Handles POST - Manually mark stage as complete (admin approval)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';
import { getNextStage } from '@/core/utils/onboarding-stage-handler';

/**
 * POST /api/onboarding/[id]/complete-stage
 * Mark current stage as complete (manual admin approval)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const body = await request.json();

    const { approvedBy, moveToNextStage } = body;

    // Get agent onboarding
    const onboarding = await prisma.agentOnboarding.findUnique({
      where: { agentId },
      include: {
        currentStage: {
          include: {
            pipeline: true,
          },
        },
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

    if (!onboarding.currentStageId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent is not in any stage',
        },
        { status: 400 }
      );
    }

    // Mark current stage as complete
    await prisma.agentOnboarding.update({
      where: { agentId },
      data: {
        stageCompletedAt: new Date(),
      },
    });

    let nextStageId: string | null = null;
    let nextStageName: string | null = null;

    // If moveToNextStage is true, automatically move to next stage
    if (moveToNextStage && onboarding.pipelineId) {
      nextStageId = await getNextStage(
        onboarding.pipelineId,
        onboarding.currentStageId
      );

      if (nextStageId) {
        const nextStage = await prisma.pipelineStage.findUnique({
          where: { id: nextStageId },
        });

        if (nextStage) {
          nextStageName = nextStage.name;
          
          // Enter next stage (assigns tasks)
          const { enterStage } = await import('@/core/utils/onboarding-stage-handler');
          await enterStage(agentId, nextStageId, approvedBy);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        completedStageId: onboarding.currentStageId,
        completedStageName: onboarding.currentStage?.name,
        stageCompletedAt: new Date().toISOString(),
        ...(nextStageId && {
          nextStageId,
          nextStageName,
          message: `Stage "${onboarding.currentStage?.name}" completed. Agent moved to "${nextStageName}".`,
        }),
        ...(!nextStageId && {
          message: `Stage "${onboarding.currentStage?.name}" completed.`,
        }),
      },
    });
  } catch (error: any) {
    console.error('Error completing stage:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to complete stage',
      },
      { status: 500 }
    );
  }
}
