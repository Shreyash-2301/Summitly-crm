export const dynamic = 'force-dynamic'

/**
 * API Route: /api/agents/[id]
 * Handles GET (get one), PUT (update), and DELETE operations
 * Using Prisma for cleaner, type-safe database operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/database/prisma';

// GET - Get single agent by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get agent with Prisma (one line!)
    const agent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not found',
        },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error: any) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch agent',
      },
      { status: 500 }
    );
  }
}

// PUT - Update agent
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if agent exists
    const existingAgent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not found',
        },
        { status: 404 }
      );
    }

    // Normalize field names - accept both camelCase and snake_case
    const firstName = body.firstName !== undefined ? (body.firstName || body.first_name || null) : undefined;
    const lastName = body.lastName !== undefined ? (body.lastName || body.last_name || null) : undefined;
    const email = body.email !== undefined ? (body.email || null) : undefined;

    console.log('📥 Received update request for agent:', id);
    console.log('📥 Update data:', body);

    // Build update data object - only include fields that are explicitly provided
    const updateData: any = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle || body.job_title || null;
    if (body.companyName !== undefined) updateData.companyName = body.companyName || body.company_name || null;
    if (body.emailOptOut !== undefined) updateData.emailOptOut = body.emailOptOut;
    if (body.phone1 !== undefined) updateData.phone1 = body.phone1 || null;
    if (body.phone2 !== undefined) updateData.phone2 = body.phone2 || null;
    if (body.fax !== undefined) updateData.fax = body.fax || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.city !== undefined) updateData.city = body.city || null;
    if (body.state !== undefined) updateData.state = body.state || null;
    if (body.country !== undefined) updateData.country = body.country || null;
    if (body.zipCode !== undefined || body.zip_code !== undefined) updateData.zipCode = body.zipCode || body.zip_code || null;
    if (body.deals !== undefined) updateData.deals = body.deals ? (Array.isArray(body.deals) ? body.deals : [body.deals]) : [];
    if (body.dateOfBirth !== undefined || body.date_of_birth !== undefined) {
      updateData.dateOfBirth = (body.dateOfBirth || body.date_of_birth) ? new Date(body.dateOfBirth || body.date_of_birth) : null;
    }
    if (body.reviews !== undefined) updateData.reviews = body.reviews ? parseFloat(body.reviews) : null;
    if (body.owner !== undefined) updateData.owner = body.owner || null;
    if (body.tags !== undefined) updateData.tags = body.tags ? (Array.isArray(body.tags) ? body.tags : [body.tags]) : [];
    if (body.source !== undefined) updateData.source = body.source || null;
    if (body.industry !== undefined) updateData.industry = body.industry || null;
    if (body.currency !== undefined) updateData.currency = body.currency || null;
    if (body.language !== undefined) updateData.language = body.language || null;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.rating !== undefined) updateData.rating = body.rating ? parseFloat(body.rating) : null;
    if (body.image !== undefined) updateData.image = body.image || null;
    // New Agent-Specific Fields
    if (body.licenseNumber !== undefined || body.license_number !== undefined) {
      updateData.licenseNumber = body.licenseNumber || body.license_number || null;
    }
    if (body.licenseExpiryDate !== undefined || body.license_expiry_date !== undefined) {
      updateData.licenseExpiryDate = (body.licenseExpiryDate || body.license_expiry_date) ? new Date(body.licenseExpiryDate || body.license_expiry_date) : null;
    }
    if (body.brokerageStartDate !== undefined || body.brokerage_start_date !== undefined) {
      updateData.brokerageStartDate = (body.brokerageStartDate || body.brokerage_start_date) ? new Date(body.brokerageStartDate || body.brokerage_start_date) : null;
    }
    if (body.teamOffice !== undefined || body.team_office !== undefined) {
      updateData.teamOffice = body.teamOffice || body.team_office || null;
    }
    if (body.commissionSplit !== undefined || body.commission_split !== undefined) {
      updateData.commissionSplit = body.commissionSplit || body.commission_split || null;
    }
    if (body.bankingInfo !== undefined || body.banking_info !== undefined) {
      updateData.bankingInfo = body.bankingInfo || body.banking_info || null;
    }
    if (body.emergencyContact !== undefined || body.emergency_contact !== undefined) {
      updateData.emergencyContact = body.emergencyContact || body.emergency_contact || null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes || null;

    console.log('📤 Prepared update data:', updateData);

    // Update agent with Prisma
    const agent = await prisma.agent.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({
      success: true,
      data: agent,
    });
  } catch (error: any) {
    console.error('Error updating agent:', error);
    
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
        error: error.message || 'Failed to update agent',
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if agent exists
    const existingAgent = await prisma.agent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not found',
        },
        { status: 404 }
      );
    }

    // Delete with Prisma (one line!)
    await prisma.agent.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete agent',
      },
      { status: 500 }
    );
  }
}
