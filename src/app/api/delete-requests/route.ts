export const dynamic = 'force-dynamic'

/**
 * API Route: /api/delete-requests
 * Handles GET (list) and POST (create) operations for delete requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/delete-requests
 * Get list of delete requests with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const [deleteRequests, total] = await Promise.all([
      prisma.deleteRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
              image: true,
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.deleteRequest.count({ where }),
    ]);

    // Transform the data
    const transformedRequests = deleteRequests.map((request: any) => ({
      id: request.id,
      userId: request.userId,
      user: {
        id: request.user.id,
        username: request.user.username,
        email: request.user.email,
        firstName: request.user.firstName,
        lastName: request.user.lastName || undefined,
        image: request.user.image || undefined,
        role: request.user.role ? {
          id: request.user.role.id,
          name: request.user.role.name,
        } : undefined,
      },
      reason: request.reason || undefined,
      status: request.status,
      requestedAt: request.requestedAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() || undefined,
      reviewedBy: request.reviewedBy || undefined,
      reviewNotes: request.reviewNotes || undefined,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: transformedRequests,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching delete requests:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch delete requests',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/delete-requests
 * Create a new delete request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      reason,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.deleteRequest.findFirst({
      where: {
        userId,
        status: 'Pending',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { success: false, error: 'A pending delete request already exists for this user' },
        { status: 409 }
      );
    }

    // Create delete request
    const deleteRequest = await prisma.deleteRequest.create({
      data: {
        userId,
        reason: reason || null,
        status: 'Pending',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            firstName: true,
            lastName: true,
            image: true,
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const transformedRequest = {
      id: deleteRequest.id,
      userId: deleteRequest.userId,
      user: {
        id: deleteRequest.user.id,
        username: deleteRequest.user.username,
        email: deleteRequest.user.email,
        firstName: deleteRequest.user.firstName,
        lastName: deleteRequest.user.lastName || undefined,
        image: deleteRequest.user.image || undefined,
        role: deleteRequest.user.role ? {
          id: deleteRequest.user.role.id,
          name: deleteRequest.user.role.name,
        } : undefined,
      },
      reason: deleteRequest.reason || undefined,
      status: deleteRequest.status,
      requestedAt: deleteRequest.requestedAt.toISOString(),
      reviewedAt: deleteRequest.reviewedAt?.toISOString() || undefined,
      reviewedBy: deleteRequest.reviewedBy || undefined,
      reviewNotes: deleteRequest.reviewNotes || undefined,
      createdAt: deleteRequest.createdAt.toISOString(),
      updatedAt: deleteRequest.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: transformedRequest,
      message: 'Delete request created successfully',
    });
  } catch (error: any) {
    console.error('Error creating delete request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create delete request',
      },
      { status: 500 }
    );
  }
}
