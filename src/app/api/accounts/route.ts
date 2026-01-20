/**
 * Flux API - Accounts Endpoint
 * GET /api/accounts
 * 
 * Returns all sponsored accounts from the database.
 * Supports filtering by status via query parameter.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const where = status ? { status } : {};

        const accounts = await prisma.sponsoredAccount.findMany({
            where,
            orderBy: { detectedAt: 'desc' },
        });

        return NextResponse.json({
            success: true,
            count: accounts.length,
            accounts,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch accounts';
        console.error('[API/accounts] Error:', message);

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
