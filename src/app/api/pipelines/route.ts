export const dynamic = 'force-dynamic'

/**
 * API Route: /api/pipelines
 * Handles GET (list) and POST (create) operations for pipelines
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/pipelines
 * Get list of pipelines with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeStages = searchParams.get('includeStages') === 'true';
    const includeAccessUsers = searchParams.get('includeAccessUsers') === 'true';

    const where: any = {};
    
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }
    
    if (status) {
      where.status = status;
    }

    const [pipelines, total] = await Promise.all([
      prisma.pipeline.findMany({
        where,
        include: {
          stages: includeStages ? {
            orderBy: { order: 'asc' },
          } : false,
          accessUsers: includeAccessUsers || false,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.pipeline.count({ where }),
    ]);

    // Transform the data to include calculated fields
    const transformedPipelines = pipelines.map((pipeline: any) => ({
      id: pipeline.id,
      name: pipeline.name,
      description: pipeline.description || undefined,
      status: pipeline.status,
      accessType: pipeline.accessType,
      createdBy: pipeline.createdBy || undefined,
      createdAt: pipeline.createdAt.toISOString(),
      updatedAt: pipeline.updatedAt.toISOString(),
      stages: includeStages && pipeline.stages
        ? pipeline.stages.map((stage: any) => ({
            id: stage.id,
            pipelineId: stage.pipelineId,
            name: stage.name,
            order: stage.order,
            color: stage.color || undefined,
            createdAt: stage.createdAt.toISOString(),
            updatedAt: stage.updatedAt.toISOString(),
          }))
        : undefined,
      accessUsers: includeAccessUsers && pipeline.accessUsers
        ? pipeline.accessUsers.map((user: any) => ({
            id: user.id,
            pipelineId: user.pipelineId,
            userId: user.userId,
            userName: user.userName || undefined,
            userEmail: user.userEmail || undefined,
            createdAt: user.createdAt.toISOString(),
          }))
        : undefined,
      // TODO: Calculate totalDealValue and numberOfDeals from deals table
      totalDealValue: '$0',
      numberOfDeals: 0,
    }));

    return NextResponse.json({
      success: true,
      data: transformedPipelines,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching pipelines:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch pipelines',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pipelines
 * Create a new pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      status = 'Active',
      accessType = 'All',
      stages = [],
      accessUserIds = [],
      createdBy,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Pipeline name is required' },
        { status: 400 }
      );
    }

    // Validate stages
    if (!Array.isArray(stages)) {
      return NextResponse.json(
        { success: false, error: 'Stages must be an array' },
        { status: 400 }
      );
    }

    // Validate accessUserIds
    if (!Array.isArray(accessUserIds)) {
      return NextResponse.json(
        { success: false, error: 'Access user IDs must be an array' },
        { status: 400 }
      );
    }

    // Create pipeline with stages and access users in a transaction
    // Increased timeout for RDS connections which may have higher latency
    const result = await prisma.$transaction(
      async (tx) => {
        // Create the pipeline
        const pipeline = await tx.pipeline.create({
          data: {
            name: name.trim(),
            description: description || null,
            status,
            accessType,
            createdBy: createdBy || null,
          },
        });

        // Create stages if provided (in parallel if possible)
        const stagePromises = [];
        if (stages.length > 0) {
          // Use createMany for better performance
          stagePromises.push(
            tx.pipelineStage.createMany({
              data: stages.map((stage: any, index: number) => ({
                pipelineId: pipeline.id,
                name: stage.name,
                order: stage.order !== undefined ? stage.order : index,
                color: stage.color || null,
              })),
            })
          );
        }

        // Create access users if accessType is 'Selected' and user IDs are provided
        if (accessType === 'Selected' && accessUserIds.length > 0) {
          stagePromises.push(
            tx.pipelineAccessUser.createMany({
              data: accessUserIds.map((userId: string) => ({
                pipelineId: pipeline.id,
                userId,
                userName: null, // TODO: Fetch from user service
                userEmail: null, // TODO: Fetch from user service
              })),
            })
          );
        }

        // Execute all creates in parallel
        await Promise.all(stagePromises);

        // Fetch the complete pipeline with relations
        const createdPipeline = await tx.pipeline.findUnique({
          where: { id: pipeline.id },
          include: {
            stages: {
              orderBy: { order: 'asc' },
            },
            accessUsers: true,
          },
        });

        if (!createdPipeline) {
          throw new Error('Pipeline not found after creation');
        }

        return createdPipeline;
      },
      {
        timeout: 30000, // 30 seconds timeout (increased for RDS latency)
        maxWait: 10000, // Maximum time to wait for a transaction slot
      }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Pipeline not found after creation' },
        { status: 500 }
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
      message: 'Pipeline created successfully',
    });
  } catch (error: any) {
    console.error('Error creating pipeline:', error);
    
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
    
    if (error.message?.includes('table') || error.message?.includes('does not exist')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Database tables not found. Please run the migration: database/migrations/006_create_pipeline_tables.sql',
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create pipeline',
      },
      { status: 500 }
    );
  }
}
