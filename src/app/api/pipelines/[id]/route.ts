export const dynamic = 'force-dynamic'

/**
 * API Route: /api/pipelines/[id]
 * Handles GET (single), PUT (update), and DELETE operations for pipelines
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/pipelines/[id]
 * Get a single pipeline by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const pipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
        accessUsers: true,
      },
    });

    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: 'Pipeline not found' },
        { status: 404 }
      );
    }

    const transformedPipeline = {
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description || undefined,
      status: pipeline.status,
      accessType: pipeline.accessType,
      createdBy: pipeline.createdBy || undefined,
      createdAt: pipeline.createdAt.toISOString(),
      updatedAt: pipeline.updatedAt.toISOString(),
      stages: pipeline.stages.map((stage: any) => ({
        id: stage.id,
        pipelineId: stage.pipelineId,
        name: stage.name,
        order: stage.order,
        color: stage.color || undefined,
        createdAt: stage.createdAt.toISOString(),
        updatedAt: stage.updatedAt.toISOString(),
      })),
      accessUsers: pipeline.accessUsers.map((user: any) => ({
        id: user.id,
        pipelineId: user.pipelineId,
        userId: user.userId,
        userName: user.userName || undefined,
        userEmail: user.userEmail || undefined,
        createdAt: user.createdAt.toISOString(),
      })),
      totalDealValue: '$0',
      numberOfDeals: 0,
    };

    return NextResponse.json({
      success: true,
      data: transformedPipeline,
    });
  } catch (error: any) {
    console.error('Error fetching pipeline:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch pipeline',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pipelines/[id]
 * Update a pipeline
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      status,
      accessType,
      stages,
      accessUserIds,
    } = body;

    // Check if pipeline exists
    const existingPipeline = await prisma.pipeline.findUnique({
      where: { id },
      include: { stages: true, accessUsers: true },
    });

    if (!existingPipeline) {
      return NextResponse.json(
        { success: false, error: 'Pipeline not found' },
        { status: 404 }
      );
    }

    // Update pipeline with stages and access users in a transaction
    const result = await prisma.$transaction(
      async (tx) => {
      // Update the pipeline
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description || null;
      if (status !== undefined) updateData.status = status;
      if (accessType !== undefined) updateData.accessType = accessType;

      const pipeline = await tx.pipeline.update({
        where: { id },
        data: updateData,
      });

      // Handle stages update
      if (stages !== undefined) {
        // Delete existing stages
        await tx.pipelineStage.deleteMany({
          where: { pipelineId: id },
        });

        // Create new stages
        if (stages.length > 0) {
          await tx.pipelineStage.createMany({
            data: stages.map((stage: any, index: number) => ({
              pipelineId: id,
              name: stage.name,
              order: stage.order !== undefined ? stage.order : index,
              color: stage.color || null,
            })),
          });
        }
      }

      // Handle access users update
      if (accessType !== undefined || accessUserIds !== undefined) {
        // Delete existing access users
        await tx.pipelineAccessUser.deleteMany({
          where: { pipelineId: id },
        });

        // Create new access users if accessType is 'Selected' and user IDs are provided
        const finalAccessType = accessType !== undefined ? accessType : existingPipeline.accessType;
        const finalUserIds = accessUserIds !== undefined ? accessUserIds : [];

        if (finalAccessType === 'Selected' && finalUserIds.length > 0) {
          await tx.pipelineAccessUser.createMany({
            data: finalUserIds.map((userId: string) => ({
              pipelineId: id,
              userId,
              userName: null, // TODO: Fetch from user service
              userEmail: null, // TODO: Fetch from user service
            })),
          });
        }
      }

      // Fetch the complete pipeline with relations
      const updatedPipeline = await tx.pipeline.findUnique({
        where: { id },
        include: {
          stages: {
            orderBy: { order: 'asc' },
          },
          accessUsers: true,
        },
      });

      if (!updatedPipeline) {
        throw new Error('Pipeline not found after update');
      }

      return updatedPipeline;
      },
      {
        timeout: 30000, // 30 seconds timeout (increased for RDS latency)
        maxWait: 10000, // Maximum time to wait for a transaction slot
      }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Pipeline not found after update' },
        { status: 404 }
      );
    }

    const transformedPipeline = {
      id: result.id,
      name: result.name,
      description: result.description || undefined,
      status: result.status,
      accessType: result.accessType,
      createdBy: result.createdBy || undefined,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      stages: result.stages.map((stage: any) => ({
        id: stage.id,
        pipelineId: stage.pipelineId,
        name: stage.name,
        order: stage.order,
        color: stage.color || undefined,
        createdAt: stage.createdAt.toISOString(),
        updatedAt: stage.updatedAt.toISOString(),
      })),
      accessUsers: result.accessUsers.map((user: any) => ({
        id: user.id,
        pipelineId: user.pipelineId,
        userId: user.userId,
        userName: user.userName || undefined,
        userEmail: user.userEmail || undefined,
        createdAt: user.createdAt.toISOString(),
      })),
      totalDealValue: '$0',
      numberOfDeals: 0,
    };

    return NextResponse.json({
      success: true,
      data: transformedPipeline,
      message: 'Pipeline updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating pipeline:', error);
    
    // Check for specific Prisma errors
    if (error.code === 'P2034') {
      return NextResponse.json(
        {
          success: false,
          error: 'Transaction timeout: The database operation took too long. This may be due to network latency or database load. Please try again in a moment.',
        },
        { status: 408 }
      );
    }
    
    // Check for connection errors
    if (error.code === 'P1001' || error.message?.includes('connect') || error.message?.includes('timeout')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database connection error: Unable to connect to the database. Please check your connection and try again.',
        },
        { status: 503 }
      );
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: 'A pipeline with this name already exists.',
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update pipeline',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pipelines/[id]
 * Delete a pipeline
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if pipeline exists
    const pipeline = await prisma.pipeline.findUnique({
      where: { id },
    });

    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: 'Pipeline not found' },
        { status: 404 }
      );
    }

    // Delete pipeline (cascade will delete stages and access users)
    await prisma.pipeline.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Pipeline deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting pipeline:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete pipeline',
      },
      { status: 500 }
    );
  }
}
