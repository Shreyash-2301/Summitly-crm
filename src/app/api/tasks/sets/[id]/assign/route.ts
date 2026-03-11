export const dynamic = 'force-dynamic'

/**
 * API Route: /api/tasks/sets/[id]/assign
 * Handles POST - Assign a task set to an agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// POST - Assign task set to agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskSetId } = await params;
    const body = await request.json();

    const { agentId, assignedBy } = body;

    // Validate required fields
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent ID is required',
        },
        { status: 400 }
      );
    }

    // Check if task set exists
    const taskSet = await prisma.taskSet.findUnique({
      where: { id: taskSetId },
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

    // Check if agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not found',
        },
        { status: 404 }
      );
    }

    // Only include active templates
    const activeTemplates = (taskSet as any).templates ? (taskSet as any).templates.filter(
      (tst: any) => tst.template.isActive
    ) : [];

    if (activeTemplates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task set has no active templates',
        },
        { status: 400 }
      );
    }

    // Create tasks from templates in a transaction
    const tasks = await prisma.$transaction(async (tx) => {
      const tasksToCreate = activeTemplates.map((tst: any) => ({
        title: tst.template.name,
        description: tst.template.description,
        category: tst.template.category,
        priority: tst.template.priority as 'Low' | 'Medium' | 'High' | 'Urgent',
        status: 'Pending' as const,
        agentId: agentId,
        templateId: tst.template.id,
        isCompleted: false,
        assignedBy: assignedBy || null,
      }));

      // Use createMany for better performance
      await tx.task.createMany({
        data: tasksToCreate,
      });

      // Fetch the created tasks
      return await tx.task.findMany({
        where: {
          agentId,
          templateId: { in: activeTemplates.map((tst: any) => tst.template.id) },
          assignedAt: {
            gte: new Date(Date.now() - 1000), // Created in the last second
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: tasksToCreate.length,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        taskSetId,
        agentId,
        tasksCreated: tasks.length,
        tasks: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
        })),
      },
      message: `Successfully assigned ${tasks.length} tasks from task set to agent`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error assigning task set:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to assign task set',
      },
      { status: 500 }
    );
  }
}
