/**
 * Flux API - Stats Endpoint
 * GET /api/stats
 * 
 * Returns aggregated statistics for the dashboard.
 */

import { NextResponse } from 'next/server';
import { getReclaimStats } from '@/lib/executioner';
import { config } from '@/lib/config';

export async function GET() {
    try {
        const stats = await getReclaimStats();

        return NextResponse.json({
            success: true,
            stats,
            isMockMode: config.isMockMode,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch stats';
        console.error('[API/stats] Error:', message);

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
