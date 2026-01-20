/**
 * Flux API - Reclaim Endpoint
 * POST /api/reclaim
 * 
 * Reclaims rent from a single account or all eligible accounts.
 * Respects dry_run_mode setting from database.
 * 
 * Request body:
 * - address: string (optional) - Specific account to reclaim
 * - all: boolean (optional) - If true, reclaim all eligible accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { reclaimAccount, reclaimAllEligible, isDryRunEnabled } from '@/lib/executioner';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { address, all } = body as { address?: string; all?: boolean };

        // Get current dry_run setting
        const dryRun = await isDryRunEnabled();

        if (all) {
            // Reclaim all eligible accounts
            const result = await reclaimAllEligible(dryRun);
            return NextResponse.json(result);
        }

        if (address) {
            // Reclaim specific account
            const result = await reclaimAccount(address, dryRun);
            return NextResponse.json(result);
        }

        return NextResponse.json(
            { success: false, error: 'Provide either "address" or "all: true"' },
            { status: 400 }
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Reclaim failed';
        console.error('[API/reclaim] Error:', message);

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
