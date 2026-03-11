export const dynamic = 'force-dynamic'

/**
 * API Route: /api/users
 * Handles GET (list) and POST (create) operations for users
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';
import bcrypt from 'bcryptjs';

/**
 * GET /api/users
 * Get list of users with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const roleId = searchParams.get('roleId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeRole = searchParams.get('includeRole') === 'true';

    const where: any = {};
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (status) {
      where.status = status;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    // Transform the data to exclude password hash
    const transformedUsers = users.map((user: any) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      emailOptOut: user.emailOptOut,
      firstName: user.firstName,
      lastName: user.lastName,
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
    }));

    return NextResponse.json({
      success: true,
      data: transformedUsers,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch users',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      username,
      email,
      emailOptOut = false,
      firstName,
      lastName,
      password,
      confirmPassword,
      phone1,
      phone2,
      location,
      image,
      status = 'Active',
      roleId,
    } = body;

    // Validate required fields
    if (!username || !email || !firstName || !password) {
      return NextResponse.json(
        { success: false, error: 'Username, email, first name, and password are required' },
        { status: 400 }
      );
    }

    // Validate password confirmation
    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Username or email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        emailOptOut,
        firstName,
        lastName: lastName || null,
        passwordHash,
        phone1: phone1 || null,
        phone2: phone2 || null,
        location: location || null,
        image: image || null,
        status,
        roleId: roleId || null,
      },
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
      message: 'User created successfully',
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    
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
        error: error.message || 'Failed to create user',
      },
      { status: 500 }
    );
  }
}
