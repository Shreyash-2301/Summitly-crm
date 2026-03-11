export const dynamic = 'force-dynamic'

/**
 * API Route: /api/agents
 * Handles GET (list all) and POST (create) operations
 * Using Prisma for cleaner, type-safe database operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// GET - List all agents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause with Prisma (much cleaner!)
    const where: any = {};
    
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // Get agents and count with Prisma (parallel queries)
    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.agent.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: agents,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch agents',
      },
      { status: 500 }
    );
  }
}

// POST - Create new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Normalize field names - accept both camelCase and snake_case
    const firstName = body.firstName || body.first_name;
    const lastName = body.lastName || body.last_name;
    const email = body.email;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        {
          success: false,
          error: 'First name, last name, and email are required',
        },
        { status: 400 }
      );
    }

    // Create agent with Prisma (much simpler!)
    const agent = await prisma.agent.create({
      data: {
        firstName,
        lastName,
        jobTitle: body.jobTitle || body.job_title || null,
        companyName: body.companyName || body.company_name || null,
        email,
        emailOptOut: body.emailOptOut !== undefined ? body.emailOptOut : (body.email_opt_out || false),
        phone1: body.phone1 || null,
        phone2: body.phone2 || null,
        fax: body.fax || null,
        address: body.address || null,
        city: body.city || null,
        state: body.state || null,
        country: body.country || null,
        zipCode: body.zipCode || body.zip_code || null,
        deals: body.deals ? (Array.isArray(body.deals) ? body.deals : [body.deals]) : [],
        dateOfBirth: body.dateOfBirth || body.date_of_birth ? new Date(body.dateOfBirth || body.date_of_birth) : null,
        reviews: body.reviews ? parseFloat(body.reviews) : null,
        owner: body.owner || null,
        tags: body.tags ? (Array.isArray(body.tags) ? body.tags : [body.tags]) : [],
        source: body.source || null,
        industry: body.industry || null,
        currency: body.currency || null,
        language: body.language || null,
        description: body.description || null,
        status: body.status || 'Active',
        rating: body.rating ? parseFloat(body.rating) : null,
        image: body.image || null,
        // New Agent-Specific Fields
        licenseNumber: body.licenseNumber || body.license_number || null,
        licenseExpiryDate: body.licenseExpiryDate || body.license_expiry_date ? new Date(body.licenseExpiryDate || body.license_expiry_date) : null,
        brokerageStartDate: body.brokerageStartDate || body.brokerage_start_date ? new Date(body.brokerageStartDate || body.brokerage_start_date) : null,
        teamOffice: body.teamOffice || body.team_office || null,
        commissionSplit: body.commissionSplit || body.commission_split || null,
        bankingInfo: body.bankingInfo || body.banking_info || null,
        emergencyContact: body.emergencyContact || body.emergency_contact || null,
        notes: body.notes || null,
      },
    });

    // Automatically create AgentOnboarding and enroll in pipeline
    // Skip if skipOnboarding is explicitly set to true
    if (body.skipOnboarding !== true) {
      try {
        // Create AgentOnboarding record
        const onboarding = await prisma.agentOnboarding.create({
          data: {
            agentId: agent.id,
            status: 'Invited',
            role: body.role || null,
            assignedOffice: body.assignedOffice || null,
            assignedTeam: body.assignedTeam || null,
            invitedBy: body.invitedBy || body.assignedBy || null,
          },
        });

        // Find "Agent Onboarding" pipeline
        const onboardingPipeline = await prisma.pipeline.findFirst({
          where: {
            name: {
              contains: 'Agent Onboarding',
              mode: 'insensitive',
            },
            status: 'Active',
          },
          include: {
            stages: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        });

        if (onboardingPipeline && onboardingPipeline.stages.length > 0) {
          // Get first stage
          const firstStage = onboardingPipeline.stages[0];

          // Enter first stage (assigns tasks and updates onboarding)
          try {
            const { enterStage } = await import('@/core/utils/onboarding-stage-handler');
            const result = await enterStage(agent.id, firstStage.id, body.assignedBy || body.invitedBy);
            
            // Update pipeline reference
            await prisma.agentOnboarding.update({
              where: { id: onboarding.id },
              data: {
                pipelineId: onboardingPipeline.id,
              },
            });
            
            console.log(`✅ Agent enrolled in pipeline "${onboardingPipeline.name}", entered stage "${firstStage.name}", and ${result.tasksCreated} tasks were assigned`);
          } catch (stageError: any) {
            // Log error but don't fail agent creation if stage entry fails
            console.error('⚠️ Error entering first stage:', stageError);
            // Still link to pipeline even if stage entry fails
            await prisma.agentOnboarding.update({
              where: { id: onboarding.id },
              data: {
                pipelineId: onboardingPipeline.id,
              },
            });
          }
        } else {
          console.log(`⚠️ "Agent Onboarding" pipeline not found or has no stages. Agent created but not enrolled in pipeline.`);
        }
      } catch (onboardingError: any) {
        // Log error but don't fail agent creation if onboarding setup fails
        console.error('⚠️ Error setting up agent onboarding:', onboardingError);
        // Continue with agent creation even if onboarding setup fails
      }
    }

    return NextResponse.json({
      success: true,
      data: agent,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating agent:', error);
    
    // Handle unique constraint violation (duplicate email) - Prisma error code
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return NextResponse.json(
        {
          success: false,
          error: 'An agent with this email already exists',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create agent',
      },
      { status: 500 }
    );
  }
}
