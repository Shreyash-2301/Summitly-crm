export const dynamic = 'force-dynamic'

/**
 * API Route: /api/roles
 * Handles GET (list) and POST (create) operations for roles
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/roles
 * Get list of roles with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includePermissions = searchParams.get('includePermissions') === 'true';
    const includeUserCount = searchParams.get('includeUserCount') === 'true';

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        include: {
          permissions: includePermissions ? {
            include: {
              permission: true,
            },
          } : false,
          users: includeUserCount ? {
            select: {
              id: true,
            },
          } : false,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.role.count({ where }),
    ]);

    // Transform the data
    const transformedRoles = roles.map((role: any) => ({
      id: role.id,
      name: role.name,
      description: role.description || undefined,
      isActive: role.isActive,
      createdBy: role.createdBy || undefined,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
      permissions: includePermissions && role.permissions
        ? role.permissions.map((rp: any) => ({
            id: rp.permission.id,
            name: rp.permission.name,
            description: rp.permission.description || undefined,
            category: rp.permission.category || undefined,
            isActive: rp.permission.isActive,
          }))
        : undefined,
      userCount: includeUserCount && role.users ? role.users.length : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: transformedRoles,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch roles',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roles
 * Create a new role
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      isActive = true,
      permissionIds = [],
      createdBy,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Role name is required' },
        { status: 400 }
      );
    }

    // Create role with permissions in a transaction
    // Increased timeout for RDS connections which may have higher latency
    const result = await prisma.$transaction(async (tx) => {
      // Create the role
      const role = await tx.role.create({
        data: {
          name: name.trim(),
          description: description || null,
          isActive,
          createdBy: createdBy || null,
        },
      });

      // Assign permissions if provided
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId: string) => ({
            roleId: role.id,
            permissionId,
            grantedBy: createdBy || null,
          })),
        });
      }

      // Return just the created role - we'll fetch full details separately if needed
      return role;
    }, {
      timeout: 30000, // 30 seconds timeout (increased for RDS latency)
      maxWait: 10000, // Maximum time to wait for a transaction slot
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Role not found after creation' },
        { status: 500 }
      );
    }

    // Transform the role (simplified - no nested queries to speed up response)
    const transformedRole = {
      id: result.id,
      name: result.name,
      description: result.description || undefined,
      isActive: result.isActive,
      createdBy: result.createdBy || undefined,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      permissions: [], // Will be loaded separately if needed
      userCount: 0, // Will be calculated separately if needed
    };

    return NextResponse.json({
      success: true,
      data: transformedRole,
      message: 'Role created successfully',
    });
  } catch (error: any) {
    console.error('Error creating role:', error);
    
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
          error: 'A role with this name already exists',
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create role',
      },
      { status: 500 }
    );
  }
}
