export const dynamic = 'force-dynamic'

/**
 * API Route: /api/roles/[id]
 * Handles GET, PUT, and DELETE operations for a specific role
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/roles/[id]
 * Get a single role by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const includePermissions = request.nextUrl.searchParams.get('includePermissions') !== 'false';
    const includeUserCount = request.nextUrl.searchParams.get('includeUserCount') === 'true';

    const role = await prisma.role.findUnique({
      where: { id },
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
    });

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    const transformedRole = {
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
        : [],
      userCount: includeUserCount && role.users ? role.users.length : undefined,
    };

    return NextResponse.json({
      success: true,
      data: transformedRole,
    });
  } catch (error: any) {
    console.error('Error fetching role:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch role',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/roles/[id]
 * Update a role
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      isActive,
      permissionIds,
    } = body;

    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Update role and permissions in a transaction
    // Increased timeout for RDS connections which may have higher latency
    const result = await prisma.$transaction(async (tx) => {
      // Update role fields
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description || null;
      if (isActive !== undefined) updateData.isActive = isActive;

      const role = await tx.role.update({
        where: { id },
        data: updateData,
      });

      // Update permissions if provided
      if (permissionIds !== undefined) {
        // Remove all existing permissions
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        // Add new permissions
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId: string) => ({
              roleId: id,
              permissionId,
            })),
          });
        }
      }

      // Return just the updated role - we'll fetch full details separately if needed
      return role;
    }, {
      timeout: 30000, // 30 seconds timeout (increased for RDS latency)
      maxWait: 10000, // Maximum time to wait for a transaction slot
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Role not found after update' },
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
      message: 'Role updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating role:', error);
    
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
        error: error.message || 'Failed to update role',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roles/[id]
 * Delete a role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Check if role is assigned to any users
    if (role.users.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete role. It is assigned to ${role.users.length} user(s). Please reassign users first.`,
        },
        { status: 400 }
      );
    }

    // Delete role (permissions will be cascade deleted)
    await prisma.role.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete role',
      },
      { status: 500 }
    );
  }
}
