export const dynamic = 'force-dynamic'

/**
 * API Route: /api/tasks/templates/[id]
 * Handles GET (single template), PUT (update), and DELETE operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// GET - Get single task template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await prisma.taskTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task template not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Error fetching task template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch task template',
      },
      { status: 500 }
    );
  }
}

// PUT - Update task template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if template exists
    const existingTemplate = await prisma.taskTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task template not found',
        },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.estimatedDuration !== undefined) updateData.estimatedDuration = body.estimatedDuration;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.order !== undefined) updateData.order = body.order;

    // Update template
    const template = await prisma.taskTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Error updating task template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update task template',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete task template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if template exists
    const template = await prisma.taskTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task template not found',
        },
        { status: 404 }
      );
    }

    // Delete template
    await prisma.taskTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Task template deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting task template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete task template',
      },
      { status: 500 }
    );
  }
}
