export const dynamic = 'force-dynamic'

/**
 * API Route: /api/permissions
 * Handles GET (list) and POST (create) operations for permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/permissions
 * Get list of permissions with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const isActive = searchParams.get('isActive');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');

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
    
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [permissions, total] = await Promise.all([
      prisma.permission.findMany({
        where,
        orderBy: [
          { category: 'asc' },
          { name: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.permission.count({ where }),
    ]);

    // Transform the data
    const transformedPermissions = permissions.map((permission) => ({
      id: permission.id,
      name: permission.name,
      description: permission.description || undefined,
      category: permission.category || undefined,
      isActive: permission.isActive,
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: transformedPermissions,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch permissions',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/permissions
 * Create a new permission
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      isActive = true,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Permission name is required' },
        { status: 400 }
      );
    }

    // Create permission
    const permission = await prisma.permission.create({
      data: {
        name: name.trim(),
        description: description || null,
        category: category || null,
        isActive,
      },
    });

    const transformedPermission = {
      id: permission.id,
      name: permission.name,
      description: permission.description || undefined,
      category: permission.category || undefined,
      isActive: permission.isActive,
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: transformedPermission,
      message: 'Permission created successfully',
    });
  } catch (error: any) {
    console.error('Error creating permission:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: 'A permission with this name already exists',
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create permission',
      },
      { status: 500 }
    );
  }
}
