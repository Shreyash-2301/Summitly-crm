export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/onboarding/[id]
 * Get single onboarding record with all details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const onboarding = await prisma.agentOnboarding.findUnique({
      where: { id },
      include: {
        agent: true,
        checklist: {
          orderBy: { stepOrder: 'asc' },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        agreements: {
          orderBy: { createdAt: 'desc' },
        },
        training: {
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Last 50 audit logs
        },
      },
    });

    if (!onboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding not found' },
        { status: 404 }
      );
    }

    // Calculate progress
    const totalSteps = onboarding.checklist.length;
    const completedSteps = onboarding.checklist.filter((c: { isCompleted: boolean }) => c.isCompleted).length;
    const requiredSteps = onboarding.checklist.filter((c: { isRequired: boolean }) => c.isRequired).length;
    const completedRequiredSteps = onboarding.checklist.filter(
      (c: { isRequired: boolean; isCompleted: boolean }) => c.isRequired && c.isCompleted
    ).length;

    const progress = {
      totalSteps,
      completedSteps,
      requiredSteps,
      completedRequiredSteps,
      progressPercentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    };

    // Check if can activate
    const canActivate = checkCanActivate(onboarding);

    return NextResponse.json({
      success: true,
      data: {
        ...onboarding,
        progress,
        canActivate: canActivate.canActivate,
        blockingIssues: canActivate.issues,
      },
    });
  } catch (error: any) {
    console.error('Error fetching onboarding:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch onboarding' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/onboarding/[id]
 * Update onboarding record
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get current onboarding to track changes
    const currentOnboarding = await prisma.agentOnboarding.findUnique({
      where: { id },
    });

    if (!currentOnboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    const oldValues: any = {};
    const newValues: any = {};

    // Status update
    if (body.status && body.status !== currentOnboarding.status) {
      oldValues.status = currentOnboarding.status;
      newValues.status = body.status;
      updateData.status = body.status;

      // Set timestamps based on status
      if (body.status === 'Onboarding Started' && !currentOnboarding.onboardingStartedAt) {
        updateData.onboardingStartedAt = new Date();
      }
      if (body.status === 'Active' && !currentOnboarding.activatedAt) {
        updateData.activatedAt = new Date();
        updateData.activatedBy = body.activatedBy || null;
      }
      if (body.status === 'Awaiting Approval' || body.status === 'Active') {
        updateData.completedAt = new Date();
      }
    }

    // Other field updates
    if (body.role !== undefined) {
      updateData.role = body.role;
      newValues.role = body.role;
    }
    if (body.assignedOffice !== undefined) {
      updateData.assignedOffice = body.assignedOffice;
      newValues.assignedOffice = body.assignedOffice;
    }
    if (body.assignedTeam !== undefined) {
      updateData.assignedTeam = body.assignedTeam;
      newValues.assignedTeam = body.assignedTeam;
    }
    if (body.adminNotes !== undefined) {
      updateData.adminNotes = body.adminNotes;
    }

    // Update onboarding
    const updatedOnboarding = await prisma.agentOnboarding.update({
      where: { id },
      data: updateData,
    });

    // Create audit log if status changed
    if (body.status && body.status !== currentOnboarding.status) {
      await prisma.onboardingAuditLog.create({
        data: {
          onboardingId: id,
          action: 'status_changed',
          actionType: 'status_change',
          description: `Status changed from ${currentOnboarding.status} to ${body.status}`,
          performedBy: body.activatedBy || body.updatedBy || null,
          performedByRole: body.activatedBy ? 'Admin' : 'System',
          oldValue: oldValues,
          newValue: newValues,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedOnboarding,
      message: 'Onboarding updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating onboarding:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update onboarding' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/onboarding/[id]
 * Delete onboarding record (cascade deletes all related records)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.agentOnboarding.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Onboarding deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting onboarding:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete onboarding' },
      { status: 500 }
    );
  }
}

/**
 * Check if onboarding can be activated
 */
function checkCanActivate(onboarding: any): { canActivate: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check all required checklist items are completed
  const incompleteRequiredSteps = onboarding.checklist.filter(
    (c: any) => c.isRequired && !c.isCompleted
  );
  if (incompleteRequiredSteps.length > 0) {
    issues.push(`${incompleteRequiredSteps.length} required steps incomplete`);
  }

  // Check all required documents are approved
  const pendingRequiredDocs = onboarding.documents.filter(
    (d: any) => d.isRequired && d.status !== 'Approved'
  );
  if (pendingRequiredDocs.length > 0) {
    issues.push(`${pendingRequiredDocs.length} required documents pending approval`);
  }

  // Check for expired required documents
  const expiredRequiredDocs = onboarding.documents.filter(
    (d: any) => d.isRequired && d.isExpired
  );
  if (expiredRequiredDocs.length > 0) {
    issues.push(`${expiredRequiredDocs.length} required documents expired`);
  }

  // Check all required agreements are signed
  const unsignedRequiredAgreements = onboarding.agreements.filter(
    (a: any) => a.isRequired && a.status !== 'Signed'
  );
  if (unsignedRequiredAgreements.length > 0) {
    issues.push(`${unsignedRequiredAgreements.length} required agreements not signed`);
  }

  // Check training is completed
  const incompleteRequiredTraining = onboarding.training.filter(
    (t: any) => t.isRequired && !t.isCompleted
  );
  if (incompleteRequiredTraining.length > 0) {
    issues.push(`${incompleteRequiredTraining.length} required training modules incomplete`);
  }

  // Check financial setup
  if (!onboarding.financialSetup) {
    issues.push('Financial setup not completed');
  }

  return {
    canActivate: issues.length === 0,
    issues,
  };
}
