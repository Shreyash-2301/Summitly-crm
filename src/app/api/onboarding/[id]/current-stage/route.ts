export const dynamic = 'force-dynamic'

/**
 * API Route: /api/onboarding/[id]/current-stage
 * Handles GET - Get current stage information for an agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';
import { isStageComplete } from '@/core/utils/onboarding-stage-handler';

/**
 * GET /api/onboarding/[id]/current-stage
 * Get current stage information and progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // Get agent onboarding with current stage
    const onboarding = await prisma.agentOnboarding.findUnique({
      where: { agentId },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        pipeline: {
          include: {
            stages: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        currentStage: {
          include: {
            taskSets: {
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
            },
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

    // Get tasks for current stage
    let stageTasks: Awaited<ReturnType<typeof prisma.task.findMany>> = [];
    let stageComplete = false;
    let tasksCompleted = 0;
    let tasksTotal = 0;

    if (onboarding.currentStageId) {
      stageTasks = await prisma.task.findMany({
        where: {
          agentId,
          stageId: onboarding.currentStageId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      tasksTotal = stageTasks.length;
      tasksCompleted = stageTasks.filter((t) => t.isCompleted).length;
      stageComplete = await isStageComplete(agentId, onboarding.currentStageId);
    }

    // Get all stages in pipeline for progress tracking
    const allStages = onboarding.pipeline?.stages || [];
    const currentStageIndex = allStages.findIndex(
      (s) => s.id === onboarding.currentStageId
    );

    return NextResponse.json({
      success: true,
      data: {
        agentId: onboarding.agentId,
        agent: onboarding.agent,
        pipeline: onboarding.pipeline
          ? {
              id: onboarding.pipeline.id,
              name: onboarding.pipeline.name,
              description: onboarding.pipeline.description,
              stages: allStages.map((stage) => ({
                id: stage.id,
                name: stage.name,
                order: stage.order,
                color: stage.color,
              })),
            }
          : null,
        currentStage: onboarding.currentStage
          ? {
              id: onboarding.currentStage.id,
              name: onboarding.currentStage.name,
              order: onboarding.currentStage.order,
              color: onboarding.currentStage.color,
              taskSets: onboarding.currentStage.taskSets.map((sts) => ({
                id: sts.taskSet.id,
                name: sts.taskSet.name,
                order: sts.order,
                isRequired: sts.isRequired,
                defaultDueDays: sts.defaultDueDays,
              })),
            }
          : null,
        stageEnteredAt: onboarding.stageEnteredAt?.toISOString(),
        stageCompletedAt: onboarding.stageCompletedAt?.toISOString(),
        tasks: stageTasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          isCompleted: task.isCompleted,
          dueDate: task.dueDate?.toISOString(),
          completedAt: task.completedAt?.toISOString(),
        })),
        progress: {
          tasksTotal,
          tasksCompleted,
          tasksRemaining: tasksTotal - tasksCompleted,
          stageComplete,
          currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : null,
          totalStages: allStages.length,
        },
        onboardingStatus: onboarding.status,
      },
    });
  } catch (error: any) {
    console.error('Error fetching current stage:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch current stage',
      },
      { status: 500 }
    );
  }
}
