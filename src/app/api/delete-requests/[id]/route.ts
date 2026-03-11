export const dynamic = 'force-dynamic'

/**
 * API Route: /api/delete-requests/[id]
 * Handles GET, PUT (approve/reject), and DELETE operations for a specific delete request
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/delete-requests/[id]
 * Get a single delete request by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deleteRequest = await prisma.deleteRequest.findUnique({
      where: { id },
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

    if (!deleteRequest) {
      return NextResponse.json(
        { success: false, error: 'Delete request not found' },
        { status: 404 }
      );
    }

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
    });
  } catch (error: any) {
    console.error('Error fetching delete request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch delete request',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/delete-requests/[id]
 * Approve or reject a delete request
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status, // 'Approved' or 'Rejected'
      reviewNotes,
      reviewedBy,
    } = body;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Status must be "Approved" or "Rejected"' },
        { status: 400 }
      );
    }

    // Check if request exists
    const existingRequest = await prisma.deleteRequest.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { success: false, error: 'Delete request not found' },
        { status: 404 }
      );
    }

    if (existingRequest.status !== 'Pending') {
      return NextResponse.json(
        { success: false, error: 'This request has already been reviewed' },
        { status: 400 }
      );
    }

    // Update request status
    const updateData: any = {
      status,
      reviewedAt: new Date(),
      reviewedBy: reviewedBy || null,
      reviewNotes: reviewNotes || null,
    };

    // If approved, delete the user
    if (status === 'Approved') {
      await prisma.$transaction(async (tx) => {
        // Update the delete request
        await tx.deleteRequest.update({
          where: { id },
          data: updateData,
        });

        // Delete the user (this will cascade delete the delete request, but we already updated it)
        await tx.user.delete({
          where: { id: existingRequest.userId },
        });
      });
    } else {
      // Just update the request status
      await prisma.deleteRequest.update({
        where: { id },
        data: updateData,
      });
    }

    return NextResponse.json({
      success: true,
      message: status === 'Approved' 
        ? 'Delete request approved and user deleted successfully'
        : 'Delete request rejected successfully',
    });
  } catch (error: any) {
    console.error('Error updating delete request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update delete request',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/delete-requests/[id]
 * Delete a delete request (cancel it)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deleteRequest = await prisma.deleteRequest.findUnique({
      where: { id },
    });

    if (!deleteRequest) {
      return NextResponse.json(
        { success: false, error: 'Delete request not found' },
        { status: 404 }
      );
    }

    await prisma.deleteRequest.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Delete request deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting delete request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete delete request',
      },
      { status: 500 }
    );
  }
}
