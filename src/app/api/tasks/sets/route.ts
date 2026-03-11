export const dynamic = 'force-dynamic'

/**
 * API Route: /api/tasks/sets
 * Handles GET (list all) and POST (create) operations for Task Sets
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// GET - List all task sets
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const includeTemplates = searchParams.get('includeTemplates') === 'true';

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    // Get task sets
    const taskSets = await prisma.taskSet.findMany({
      where,
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
      include: includeTemplates ? {
        templates: {
          include: {
            template: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      } : undefined,
    });

    // Transform data to match interface
    const transformedSets = taskSets.map((set: any) => ({
      id: set.id,
      name: set.name,
      description: set.description || undefined,
      category: set.category || undefined,
      isActive: set.isActive,
      order: set.order,
      createdAt: set.createdAt.toISOString(),
      updatedAt: set.updatedAt.toISOString(),
      createdBy: set.createdBy || undefined,
      templates: includeTemplates && set.templates ? set.templates.map((tst: any) => ({
        id: tst.template.id,
        name: tst.template.name,
        description: tst.template.description || undefined,
        category: tst.template.category || undefined,
        priority: tst.template.priority as 'Low' | 'Medium' | 'High' | 'Urgent',
        estimatedDuration: tst.template.estimatedDuration || undefined,
        isActive: tst.template.isActive,
        order: tst.template.order,
        createdAt: tst.template.createdAt.toISOString(),
        updatedAt: tst.template.updatedAt.toISOString(),
        createdBy: tst.template.createdBy || undefined,
      })) : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: transformedSets,
      total: transformedSets.length,
    });
  } catch (error: any) {
    console.error('Error fetching task sets:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch task sets',
      },
      { status: 500 }
    );
  }
}

// POST - Create new task set
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set name is required',
        },
        { status: 400 }
      );
    }

    // Create task set with templates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the task set
      const taskSet = await tx.taskSet.create({
        data: {
          name: body.name,
          description: body.description || null,
          category: body.category || null,
          isActive: body.isActive !== undefined ? body.isActive : true,
          order: body.order || 0,
          createdBy: body.createdBy || null,
        },
      });

      // Add templates to the set if provided
      if (body.templateIds && Array.isArray(body.templateIds) && body.templateIds.length > 0) {
        // Validate that all template IDs exist
        const templates = await tx.taskTemplate.findMany({
          where: {
            id: { in: body.templateIds },
          },
        });

        if (templates.length !== body.templateIds.length) {
          throw new Error('One or more template IDs are invalid');
        }

        // Create join table entries
        const templateEntries = body.templateIds.map((templateId: string, index: number) => ({
          taskSetId: taskSet.id,
          templateId,
          order: index,
        }));

        await tx.taskSetTemplate.createMany({
          data: templateEntries,
        });
      }

      // Fetch the created set with templates
      return await tx.taskSet.findUnique({
        where: { id: taskSet.id },
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
      });
    });

    // Transform response
    const transformedSet = {
      id: result!.id,
      name: result!.name,
      description: result!.description || undefined,
      category: result!.category || undefined,
      isActive: result!.isActive,
      order: result!.order,
      createdAt: result!.createdAt.toISOString(),
      updatedAt: result!.updatedAt.toISOString(),
      createdBy: result!.createdBy || undefined,
      templates: (result as any).templates ? (result as any).templates.map((tst: any) => ({
        id: tst.template.id,
        name: tst.template.name,
        description: tst.template.description || undefined,
        category: tst.template.category || undefined,
        priority: tst.template.priority as 'Low' | 'Medium' | 'High' | 'Urgent',
        estimatedDuration: tst.template.estimatedDuration || undefined,
        isActive: tst.template.isActive,
        order: tst.template.order,
        createdAt: tst.template.createdAt.toISOString(),
        updatedAt: tst.template.updatedAt.toISOString(),
        createdBy: tst.template.createdBy || undefined,
      })) : undefined,
    };

    return NextResponse.json({
      success: true,
      data: transformedSet,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task set:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create task set',
      },
      { status: 500 }
    );
  }
}
