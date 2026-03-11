export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/onboarding/[id]/documents/[documentId]
 * Get single document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { documentId } = await params;

    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error: any) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/onboarding/[id]/documents/[documentId]
 * Update document (approve/reject)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { documentId, id } = await params;
    const body = await request.json();

    const { status, adminNotes, rejectionReason, statusChangedBy } = body;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Valid status (Approved/Rejected) is required' },
        { status: 400 }
      );
    }

    // Get current document
    const currentDocument = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
    });

    if (!currentDocument) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Update document
    const updatedDocument = await prisma.onboardingDocument.update({
      where: { id: documentId },
      data: {
        status,
        statusChangedAt: new Date(),
        statusChangedBy: statusChangedBy || null,
        adminNotes: adminNotes || null,
        rejectionReason: status === 'Rejected' ? (rejectionReason || null) : null,
      },
    });

    // Create audit log
    await prisma.onboardingAuditLog.create({
      data: {
        onboardingId: id,
        action: 'document_reviewed',
        actionType: 'document_review',
        description: `Document ${currentDocument.documentName} ${status.toLowerCase()}`,
        performedBy: statusChangedBy || null,
        performedByRole: 'Admin',
        oldValue: { status: currentDocument.status },
        newValue: { status, adminNotes, rejectionReason },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedDocument,
      message: `Document ${status.toLowerCase()} successfully`,
    });
  } catch (error: any) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/onboarding/[id]/documents/[documentId]
 * Delete document
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { documentId, id } = await params;

    const document = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // If this is a required document, create a new version instead of deleting
    if (document.isRequired && document.status === 'Approved') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete approved required document. Upload a new version instead.' },
        { status: 400 }
      );
    }

    await prisma.onboardingDocument.delete({
      where: { id: documentId },
    });

    // Create audit log
    await prisma.onboardingAuditLog.create({
      data: {
        onboardingId: id,
        action: 'document_deleted',
        actionType: 'document_delete',
        description: `Document ${document.documentName} deleted`,
        performedBy: null, // TODO: Get from auth
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete document' },
      { status: 500 }
    );
  }
}
