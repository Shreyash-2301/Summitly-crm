export const dynamic = 'force-dynamic'

/**
 * API Route: /api/users/[id]
 * Handles GET (get single), PUT (update), and DELETE operations for a specific user
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';
import bcrypt from 'bcryptjs';

/**
 * GET /api/users/[id]
 * Get a single user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const includeRole = request.nextUrl.searchParams.get('includeRole') === 'true';

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: includeRole ? {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        } : false,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Transform response (exclude password hash)
    const transformedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      emailOptOut: user.emailOptOut,
      firstName: user.firstName,
      lastName: user.lastName || undefined,
      phone1: user.phone1 || undefined,
      phone2: user.phone2 || undefined,
      location: user.location || undefined,
      image: user.image || undefined,
      status: user.status,
      roleId: user.roleId || undefined,
      role: user.role ? {
        id: user.role.id,
        name: user.role.name,
        description: user.role.description || undefined,
        isActive: user.role.isActive,
        permissions: (user.role as any).permissions?.map((rp: any) => ({
          id: rp.permission.id,
          name: rp.permission.name,
          description: rp.permission.description || undefined,
          category: rp.permission.category || undefined,
        })) || [],
      } : undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() || undefined,
    };

    return NextResponse.json({
      success: true,
      data: transformedUser,
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch user',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[id]
 * Update a user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      username,
      email,
      emailOptOut,
      firstName,
      lastName,
      password,
      confirmPassword,
      phone1,
      phone2,
      location,
      image,
      status,
      roleId,
    } = body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Validate password if provided
    if (password) {
      if (password !== confirmPassword) {
        return NextResponse.json(
          { success: false, error: 'Passwords do not match' },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 8 characters long' },
          { status: 400 }
        );
      }
    }

    // Check if username or email is being changed and already exists
    if (username || email) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                username ? { username } : {},
                email ? { email } : {},
              ],
            },
          ],
        },
      });

      if (duplicateUser) {
        return NextResponse.json(
          { success: false, error: 'Username or email already exists' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (emailOptOut !== undefined) updateData.emailOptOut = emailOptOut;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName || null;
    if (phone1 !== undefined) updateData.phone1 = phone1 || null;
    if (phone2 !== undefined) updateData.phone2 = phone2 || null;
    if (location !== undefined) updateData.location = location || null;
    if (image !== undefined) updateData.image = image || null;
    if (status !== undefined) updateData.status = status;
    if (roleId !== undefined) updateData.roleId = roleId || null;

    // Hash password if provided
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    // Transform response (exclude password hash)
    const transformedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      emailOptOut: user.emailOptOut,
      firstName: user.firstName,
      lastName: user.lastName || undefined,
      phone1: user.phone1 || undefined,
      phone2: user.phone2 || undefined,
      location: user.location || undefined,
      image: user.image || undefined,
      status: user.status,
      roleId: user.roleId || undefined,
      role: user.role ? {
        id: user.role.id,
        name: user.role.name,
        description: user.role.description || undefined,
        isActive: user.role.isActive,
        permissions: user.role.permissions?.map((rp: any) => ({
          id: rp.permission.id,
          name: rp.permission.name,
          description: rp.permission.description || undefined,
          category: rp.permission.category || undefined,
        })) || [],
      } : undefined,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() || undefined,
    };

    return NextResponse.json({
      success: true,
      data: transformedUser,
      message: 'User updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          success: false,
          error: 'Username or email already exists',
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update user',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete user',
      },
      { status: 500 }
    );
  }
}
