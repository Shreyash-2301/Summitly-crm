export const dynamic = 'force-dynamic'

/**
 * API Route: /api/onboarding/stats
 * Returns onboarding statistics for the LaunchPad dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // First day of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // First day of last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Last day of last month
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Get all agents count
    const totalAgents = await prisma.agent.count();

    // New Hires (today) - agents created today
    const newHiresToday = await prisma.agent.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // New Hires (this month) - agents created this month
    const newHiresThisMonth = await prisma.agent.count({
      where: {
        createdAt: {
          gte: monthStart,
        },
      },
    });

    // New Hires (last month) - agents created last month
    const newHiresLastMonth = await prisma.agent.count({
      where: {
        createdAt: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
    });

    // Get onboarding records
    const allOnboardings = await prisma.agentOnboarding.findMany({
      include: {
        agent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            createdAt: true,
          },
        },
        checklist: true,
      },
    });

    // Calculate onboarding stats
    const newHiresInQueue = allOnboardings.filter(
      (o) => o.status === 'Invited' || o.status === 'Onboarding Started'
    ).length;

    const incompleteOnboarding = allOnboardings.filter(
      (o) => o.status !== 'Active' && o.status !== 'Terminated'
    ).length;

    // Past due - onboarding records that are incomplete and past expected completion
    // Assuming 30 days from creation is the expected completion time
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const pastDue = allOnboardings.filter((o) => {
      const isIncomplete = o.status !== 'Active' && o.status !== 'Terminated';
      const isPastDue = o.createdAt < thirtyDaysAgo;
      return isIncomplete && isPastDue;
    }).length;

    // Pending Actions
    // New hires to onboard - agents without onboarding records
    const agentsWithoutOnboarding = await prisma.agent.findMany({
      where: {
        onboarding: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
    });

    const newHiresToOnboard = agentsWithoutOnboarding.length;

    // Incoming onboarding records - onboarding records that need review
    const incomingOnboardingRecords = allOnboardings.filter(
      (o) => 
        o.status === 'Compliance Pending' || 
        o.status === 'Awaiting Approval' ||
        (o.status === 'Onboarding Started' && !o.profileCompleted)
    ).length;

    // Convert to agent - agents with onboarding status "Awaiting Approval"
    const convertToAgent = allOnboardings.filter(
      (o) => o.status === 'Awaiting Approval'
    ).length;

    // Documents pending review
    const documentsPendingReview = await prisma.onboardingDocument.count({
      where: {
        status: 'Pending',
      },
    });

    // Overdue tasks - tasks past their due date and not completed
    const overdueTasks = await prisma.task.count({
      where: {
        dueDate: {
          lt: now,
        },
        isCompleted: false,
        status: {
          not: 'Cancelled',
        },
      },
    });

    // Invitations not accepted - invitations sent but not accepted
    const invitationsNotAccepted = await prisma.agentOnboarding.count({
      where: {
        invitationSentAt: {
          not: null,
        },
        invitationAcceptedAt: null,
        OR: [
          {
            invitationExpiresAt: null,
          },
          {
            invitationExpiresAt: {
              gte: now, // Not expired yet
            },
          },
        ],
      },
    });

    // Documents rejected - need resubmission
    const documentsRejected = await prisma.onboardingDocument.count({
      where: {
        status: 'Rejected',
      },
    });

    // Expiring documents - documents expiring within 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringDocuments = await prisma.onboardingDocument.count({
      where: {
        expiryDate: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
        isExpired: false,
        status: 'Approved',
      },
    });

    // New hires this month with details
    const newHiresThisMonthDetails = await prisma.agent.findMany({
      where: {
        createdAt: {
          gte: monthStart,
        },
      },
      include: {
        onboarding: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to 50 most recent
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          newHiresToday,
          newHiresThisMonth,
          newHiresLastMonth,
          agentsOnFile: totalAgents,
        },
        pendingActions: {
          newHiresToOnboard,
          incomingOnboardingRecords,
          convertToAgent,
          documentsPendingReview,
          overdueTasks,
          invitationsNotAccepted,
          documentsRejected,
          expiringDocuments,
        },
        onboardingStatus: {
          newHiresInQueue,
          incompleteOnboarding,
          pastDue,
        },
        newHiresThisMonth: newHiresThisMonthDetails.map((agent) => ({
          id: agent.id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          email: agent.email,
          createdAt: agent.createdAt.toISOString(),
          onboardingStatus: agent.onboarding?.status || 'Not Started',
          onboardingId: agent.onboarding?.id || null,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching onboarding stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch onboarding stats',
      },
      { status: 500 }
    );
  }
}
