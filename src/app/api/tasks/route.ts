export const dynamic = 'force-dynamic'

/**
 * API Route: /api/tasks
 * Handles GET (list all) and POST (create) operations for tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// GET - List all tasks
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const agentId = searchParams.get('agentId');
    const userId = searchParams.get('userId');
    const isCompleted = searchParams.get('isCompleted');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (agentId) {
      where.agentId = agentId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (isCompleted !== null && isCompleted !== undefined) {
      where.isCompleted = isCompleted === 'true';
    }

    // Get tasks and count
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
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
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: tasks,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch tasks',
      },
      { status: 500 }
    );
  }
}

// POST - Create new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title) {
      return NextResponse.json(
        {
          success: false,
          error: 'Task title is required',
        },
        { status: 400 }
      );
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title: body.title,
        description: body.description || null,
        category: body.category || null,
        priority: body.priority || 'Medium',
        status: body.status || 'Pending',
        agentId: body.agentId || null,
        userId: body.userId || null,
        templateId: body.templateId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        tags: body.tags ? (Array.isArray(body.tags) ? body.tags : [body.tags]) : [],
        notes: body.notes || null,
        assignedBy: body.assignedBy || null,
        isCompleted: body.isCompleted || false,
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        completedBy: body.completedBy || null,
      },
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
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create task',
      },
      { status: 500 }
    );
  }
}
