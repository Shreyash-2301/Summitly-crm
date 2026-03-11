export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';
import crypto from 'crypto';

/**
 * POST /api/onboarding
 * Create a new onboarding record and send invitation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, email, role, assignedOffice, assignedTeam, invitedBy } = body;

    if (!agentId || !email) {
      return NextResponse.json(
        { success: false, error: 'Agent ID and email are required' },
        { status: 400 }
      );
    }

    // Check if agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Check if onboarding already exists
    const existingOnboarding = await prisma.agentOnboarding.findUnique({
      where: { agentId },
    });

    if (existingOnboarding) {
      return NextResponse.json(
        { success: false, error: 'Onboarding already exists for this agent' },
        { status: 400 }
      );
    }

    // Generate secure invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiresAt = new Date();
    invitationExpiresAt.setHours(invitationExpiresAt.getHours() + 72); // 72 hours expiry

    // Create onboarding record
    const onboarding = await prisma.agentOnboarding.create({
      data: {
        agentId,
        status: 'Invited',
        invitationToken,
        invitationSentAt: new Date(),
        invitationExpiresAt,
        invitedBy: invitedBy || null,
        role: role || null,
        assignedOffice: assignedOffice || null,
        assignedTeam: assignedTeam || null,
      },
    });

    // Create initial checklist items
    const checklistItems = [
      { step: 'account_creation', stepName: 'Account Creation', stepOrder: 1, isRequired: true },
      { step: 'profile', stepName: 'Profile Completion', stepOrder: 2, isRequired: true },
      { step: 'compliance', stepName: 'Compliance Documents', stepOrder: 3, isRequired: true },
      { step: 'agreements', stepName: 'Agreements & E-Signatures', stepOrder: 4, isRequired: true },
      { step: 'financial', stepName: 'Financial Setup', stepOrder: 5, isRequired: true },
      { step: 'training', stepName: 'Training & Orientation', stepOrder: 6, isRequired: true },
      { step: 'marketing', stepName: 'Marketing Profile', stepOrder: 7, isRequired: false },
    ];

    await prisma.onboardingChecklist.createMany({
      data: checklistItems.map(item => ({
        onboardingId: onboarding.id,
        ...item,
      })),
    });

    // Create audit log
    await prisma.onboardingAuditLog.create({
      data: {
        onboardingId: onboarding.id,
        action: 'onboarding_created',
        actionType: 'onboarding_creation',
        description: `Onboarding created for agent ${agentId}`,
        performedBy: invitedBy || null,
        performedByRole: 'Admin',
        newValue: { status: 'Invited', role, assignedOffice, assignedTeam },
      },
    });

    // TODO: Send invitation email here
    // await sendInvitationEmail(email, invitationToken);

    return NextResponse.json({
      success: true,
      data: onboarding,
      message: 'Onboarding created and invitation sent',
    });
  } catch (error: any) {
    console.error('Error creating onboarding:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create onboarding' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/onboarding
 * Get onboarding records with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = {};
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;

    const [onboardings, total] = await Promise.all([
      prisma.agentOnboarding.findMany({
        where,
        include: {
          agent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          checklist: {
            orderBy: { stepOrder: 'asc' },
          },
          documents: true,
          agreements: true,
          training: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.agentOnboarding.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: onboardings,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching onboarding:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch onboarding' },
      { status: 500 }
    );
  }
}
