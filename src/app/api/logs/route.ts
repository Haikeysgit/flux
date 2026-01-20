/**
 * Flux API - Activity Logs Endpoint
 * GET /api/logs
 * 
 * Returns the activity log (audit trail) from the database.
 * Supports filtering by mode (REAL/SIMULATION) and action type.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode');
        const action = searchParams.get('action');
        const limit = parseInt(searchParams.get('limit') || '100', 10);

        const where: Record<string, string> = {};
        if (mode) where.mode = mode;
        if (action) where.action = action;

        const logs = await prisma.activityLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: Math.min(limit, 1000), // Cap at 1000
        });

        return NextResponse.json({
            success: true,
            count: logs.length,
            logs,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch logs';
        console.error('[API/logs] Error:', message);

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
