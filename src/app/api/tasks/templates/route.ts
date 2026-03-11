export const dynamic = 'force-dynamic'

/**
 * API Route: /api/tasks/templates
 * Handles GET (list all) and POST (create) operations for task templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// GET - List all task templates
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (category) {
      where.category = category;
    }

    // Get templates and count
    const [templates, total] = await Promise.all([
      prisma.taskTemplate.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [
          { order: 'asc' },
          { createdAt: 'desc' },
        ],
      }),
      prisma.taskTemplate.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: templates,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching task templates:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch task templates',
      },
      { status: 500 }
    );
  }
}

// POST - Create new task template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template name is required',
        },
        { status: 400 }
      );
    }

    // Create template
    const template = await prisma.taskTemplate.create({
      data: {
        name: body.name,
        description: body.description || null,
        category: body.category || null,
        priority: body.priority || 'Medium',
        estimatedDuration: body.estimatedDuration || null,
        isActive: body.isActive !== undefined ? body.isActive : true,
        order: body.order || 0,
        createdBy: body.createdBy || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating task template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create task template',
      },
      { status: 500 }
    );
  }
}
