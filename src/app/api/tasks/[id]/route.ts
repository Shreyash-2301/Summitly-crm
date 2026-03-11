export const dynamic = 'force-dynamic'

/**
 * API Route: /api/tasks/[id]
 * Handles GET (single task), PUT (update), and DELETE operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// GET - Get single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        template: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch task',
      },
      { status: 500 }
    );
  }
}

// PUT - Update task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if task exists
    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task not found',
        },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.isCompleted !== undefined) {
      updateData.isCompleted = body.isCompleted;
      // Auto-set completedAt if marking as completed
      if (body.isCompleted && !existingTask.completedAt) {
        updateData.completedAt = new Date();
      }
      // Clear completedAt if unmarking
      if (!body.isCompleted) {
        updateData.completedAt = null;
        updateData.completedBy = null;
      }
    }
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null;
    if (body.completedBy !== undefined) updateData.completedBy = body.completedBy;
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.tags !== undefined) updateData.tags = Array.isArray(body.tags) ? body.tags : [body.tags];
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.agentId !== undefined) updateData.agentId = body.agentId || null;
    if (body.userId !== undefined) updateData.userId = body.userId || null;
    if (body.templateId !== undefined) updateData.templateId = body.templateId || null;

    // Update task
    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        template: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: task,
    });
  } catch (error: any) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update task',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if task exists
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task not found',
        },
        { status: 404 }
      );
    }

    // Delete task
    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete task',
      },
      { status: 500 }
    );
  }
}
