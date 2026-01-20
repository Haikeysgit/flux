/**
 * Flux API - Scan Endpoint
 * POST /api/scan
 * 
 * Triggers a blockchain scan to discover sponsored accounts.
 * In Mock Mode, returns simulated scan results.
 */

import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { scanForSponsoredAccounts, performMockScan } from '@/lib/scanner';
import { config } from '@/lib/config';
import { prisma } from '@/lib/prisma';
import { seedDemoData } from '@/lib/demoSeeder';

export async function POST() {
    try {
        // Check if Simulation Mode is enabled (from UI toggle)
        const dryRunSetting = await prisma.settings.findUnique({
            where: { key: 'dry_run_mode' },
        });
        const isSimulationMode = dryRunSetting?.value === 'true';

        // In Mock Mode OR Simulation Mode, restore demo data and perform mock scan
        if (config.isMockMode || !config.operatorPublicKey || isSimulationMode) {
            console.log('[Scan] Running in simulation mode');

            // Restore demo data so the UI always has accounts to display
            const accountCount = await seedDemoData();

            return NextResponse.json({
                success: true,
                newAccounts: accountCount,
                updatedAccounts: 0,
                totalAccounts: accountCount,
                timestamp: new Date(),
                mode: 'simulation',
            });
        }

        // REAL MODE: Clear previous demo data before scanning
        console.log('[Scan] Running in real mode - connecting to Solana...');
        await prisma.sponsoredAccount.deleteMany({});

        // Real scan with operator public key
        const operatorKey = new PublicKey(config.operatorPublicKey);
        const result = await scanForSponsoredAccounts(operatorKey);

        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Scan failed';
        console.error('[API/scan] Error:', message);

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
