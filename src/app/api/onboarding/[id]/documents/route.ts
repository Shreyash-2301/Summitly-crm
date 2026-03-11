export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/onboarding/[id]/documents
 * Get all documents for an onboarding
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const documents = await prisma.onboardingDocument.findMany({
      where: { onboardingId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: documents,
    });
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/onboarding/[id]/documents
 * Upload a new document
 * Note: File upload handling should be done via FormData
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();

    const documentType = formData.get('documentType') as string;
    const documentName = formData.get('documentName') as string;
    const file = formData.get('file') as File;
    const expiryDate = formData.get('expiryDate') as string | null;
    const isRequired = formData.get('isRequired') === 'true';

    if (!documentType || !documentName || !file) {
      return NextResponse.json(
        { success: false, error: 'Document type, name, and file are required' },
        { status: 400 }
      );
    }

    // TODO: Implement actual file upload to secure storage (S3, etc.)
    // For now, we'll store metadata
    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type;
    
    // Generate secure file path (in production, upload to S3/secure storage)
    const filePath = `onboarding/${id}/${Date.now()}_${fileName}`;

    const document = await prisma.onboardingDocument.create({
      data: {
        onboardingId: id,
        documentType,
        documentName,
        fileName,
        filePath,
        fileSize,
        mimeType,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isRequired,
        status: 'Pending',
        uploadedBy: formData.get('uploadedBy') as string || null,
        uploadIp: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      },
    });

    // Create audit log
    await prisma.onboardingAuditLog.create({
      data: {
        onboardingId: id,
        action: 'document_uploaded',
        actionType: 'document_upload',
        description: `Document ${documentName} uploaded`,
        performedBy: formData.get('uploadedBy') as string || null,
        newValue: { documentType, documentName, fileName },
      },
    });

    return NextResponse.json({
      success: true,
      data: document,
      message: 'Document uploaded successfully',
    });
  } catch (error: any) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload document' },
      { status: 500 }
    );
  }
}
