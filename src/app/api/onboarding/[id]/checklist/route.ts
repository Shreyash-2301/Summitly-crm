export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

/**
 * GET /api/onboarding/[id]/checklist
 * Get checklist items for an onboarding
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const checklist = await prisma.onboardingChecklist.findMany({
      where: { onboardingId: id },
      orderBy: { stepOrder: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: checklist,
    });
  } catch (error: any) {
    console.error('Error fetching checklist:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch checklist' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/onboarding/[id]/checklist
 * Update checklist item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { stepId } = body;
    if (!stepId) {
      return NextResponse.json(
        { success: false, error: 'stepId is required in request body' },
        { status: 400 }
      );
    }

    const checklistItem = await prisma.onboardingChecklist.update({
      where: { id: stepId },
      data: {
        isCompleted: body.isCompleted ?? undefined,
        completedAt: body.isCompleted ? new Date() : null,
        completedBy: body.completedBy || null,
        stepData: body.stepData || undefined,
      },
    });

    // Create audit log
    await prisma.onboardingAuditLog.create({
      data: {
        onboardingId: id,
        action: 'checklist_updated',
        actionType: 'checklist_update',
        description: `Checklist item ${checklistItem.stepName} ${body.isCompleted ? 'completed' : 'marked incomplete'}`,
        performedBy: body.completedBy || null,
        newValue: { step: checklistItem.step, isCompleted: body.isCompleted },
      },
    });

    return NextResponse.json({
      success: true,
      data: checklistItem,
    });
  } catch (error: any) {
    console.error('Error updating checklist:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update checklist' },
      { status: 500 }
    );
  }
}
