export const dynamic = 'force-dynamic'

/**
 * API Route: /api/tasks/sets/[id]
 * Handles GET (get one), PUT (update), and DELETE operations for Task Sets
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// GET - Get single task set by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const taskSet = await prisma.taskSet.findUnique({
      where: { id },
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

    if (!taskSet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set not found',
        },
        { status: 404 }
      );
    }

    // Transform response
    const transformedSet = {
      id: taskSet.id,
      name: taskSet.name,
      description: taskSet.description || undefined,
      category: taskSet.category || undefined,
      isActive: taskSet.isActive,
      order: taskSet.order,
      createdAt: taskSet.createdAt.toISOString(),
      updatedAt: taskSet.updatedAt.toISOString(),
      createdBy: taskSet.createdBy || undefined,
      templates: (taskSet as any).templates ? (taskSet as any).templates.map((tst: any) => ({
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
    });
  } catch (error: any) {
    console.error('Error fetching task set:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch task set',
      },
      { status: 500 }
    );
  }
}

// PUT - Update task set
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if task set exists
    const existingSet = await prisma.taskSet.findUnique({
      where: { id },
    });

    if (!existingSet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set not found',
        },
        { status: 404 }
      );
    }

    // Update task set and templates in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the task set
      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description || null;
      if (body.category !== undefined) updateData.category = body.category || null;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.order !== undefined) updateData.order = body.order;

      const taskSet = await tx.taskSet.update({
        where: { id },
        data: updateData,
      });

      // Update templates if provided
      if (body.templateIds !== undefined) {
        // Delete existing template associations
        await tx.taskSetTemplate.deleteMany({
          where: { taskSetId: id },
        });

        // Add new template associations
        if (Array.isArray(body.templateIds) && body.templateIds.length > 0) {
          // Validate that all template IDs exist
          const templates = await tx.taskTemplate.findMany({
            where: {
              id: { in: body.templateIds },
            },
          });

          if (templates.length !== body.templateIds.length) {
            throw new Error('One or more template IDs are invalid');
          }

          // Create new join table entries
          const templateEntries = body.templateIds.map((templateId: string, index: number) => ({
            taskSetId: id,
            templateId,
            order: index,
          }));

          await tx.taskSetTemplate.createMany({
            data: templateEntries,
          });
        }
      }

      // Fetch the updated set with templates
      return await tx.taskSet.findUnique({
        where: { id },
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
    });
  } catch (error: any) {
    console.error('Error updating task set:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update task set',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete task set
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if task set exists
    const existingSet = await prisma.taskSet.findUnique({
      where: { id },
    });

    if (!existingSet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set not found',
        },
        { status: 404 }
      );
    }

    // Delete task set (cascade will delete template associations)
    await prisma.taskSet.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Task set deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting task set:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete task set',
      },
      { status: 500 }
    );
  }
}
