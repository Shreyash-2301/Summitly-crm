export const dynamic = 'force-dynamic'

/**
 * API Route: /api/onboarding/stages
 * Returns agents grouped by their current pipeline stage
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get the "Agent Onboarding" pipeline (or first active pipeline)
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        status: 'Active',
        name: {
          contains: 'Onboarding',
          mode: 'insensitive',
        },
      },
      include: {
        stages: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!pipeline) {
      return NextResponse.json({
        success: true,
        data: {
          pipeline: null,
          stages: [],
        },
      });
    }

    // Get all onboarding records with agents, grouped by current stage
    const onboardingRecords = await prisma.agentOnboarding.findMany({
      where: {
        pipelineId: pipeline.id,
      },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone1: true,
            image: true,
            createdAt: true,
            status: true,
          },
        },
        currentStage: {
          select: {
            id: true,
            name: true,
            order: true,
            color: true,
          },
        },
      },
      orderBy: {
        stageEnteredAt: 'desc',
      },
    });

    // Group agents by stage
    const agentsByStage: Record<string, typeof onboardingRecords> = {};
    
    // Initialize all stages
    pipeline.stages.forEach((stage) => {
      agentsByStage[stage.id] = [];
    });

    // Add a stage for agents without a current stage
    agentsByStage['no-stage'] = [];

    // Group agents
    onboardingRecords.forEach((record) => {
      const stageId = record.currentStageId || 'no-stage';
      if (!agentsByStage[stageId]) {
        agentsByStage[stageId] = [];
      }
      agentsByStage[stageId].push(record);
    });

    // Transform the data
    const stagesData = pipeline.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      order: stage.order,
      color: stage.color || undefined,
      agents: (agentsByStage[stage.id] || []).map((record) => ({
        id: record.agent.id,
        firstName: record.agent.firstName,
        lastName: record.agent.lastName,
        email: record.agent.email,
        phone1: record.agent.phone1 || undefined,
        image: record.agent.image || undefined,
        status: record.agent.status,
        onboardingStatus: record.status,
        onboardingId: record.id,
        stageEnteredAt: record.stageEnteredAt?.toISOString(),
        createdAt: record.agent.createdAt.toISOString(),
      })),
      agentCount: agentsByStage[stage.id]?.length || 0,
    }));

    // Add agents without a stage
    const noStageAgents = (agentsByStage['no-stage'] || []).map((record) => ({
      id: record.agent.id,
      firstName: record.agent.firstName,
      lastName: record.agent.lastName,
      email: record.agent.email,
      phone1: record.agent.phone1 || undefined,
      image: record.agent.image || undefined,
      status: record.agent.status,
      onboardingStatus: record.status,
      onboardingId: record.id,
      stageEnteredAt: record.stageEnteredAt?.toISOString(),
      createdAt: record.agent.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        pipeline: {
          id: pipeline.id,
          name: pipeline.name,
          description: pipeline.description || undefined,
        },
        stages: stagesData,
        noStageAgents,
      },
    });
  } catch (error: any) {
    console.error('Error fetching agents by stage:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch agents by stage',
      },
      { status: 500 }
    );
  }
}
