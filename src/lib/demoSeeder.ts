/**
 * Flux (Kora Rent Guardian) - Demo Data Seeder
 * 
 * This module provides a function to restore demo data for Simulation Mode.
 * Called when switching from Real Mode to Simulation Mode to ensure judges
 * always have data to view in the dashboard.
 */

import { prisma } from './prisma';

// Standard rent-exempt minimum for token accounts
const RENT_MINIMUM = 0.00203928;

/**
 * Helper to create dates relative to now
 */
function daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Seeds demo accounts and activity logs for Simulation Mode.
 * Clears existing data and inserts fresh demo data.
 * 
 * @returns Number of accounts created
 */
export async function seedDemoData(): Promise<number> {
    console.log('[DemoSeeder] Restoring demo data for Simulation Mode...');

    // Clear existing accounts (but keep settings and whitelist)
    await prisma.sponsoredAccount.deleteMany();

    // Create demo accounts
    await prisma.sponsoredAccount.createMany({
        data: [
            // THE WHALE (1 account) - Drives alert trigger
            {
                address: '8xKVzxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxWhale1',
                balance: 0.85000000,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(92),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(120),
            },

            // MID-TIER (2 accounts) - Moderate deposits
            {
                address: '5mTRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxMidTr1',
                balance: 0.05200000,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(48),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(65),
            },
            {
                address: '7kPQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxMidTr2',
                balance: 0.04800000,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(55),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(70),
            },

            // THE DUST (6 accounts) - Standard rent deposits
            {
                address: '2dSTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxDust01',
                balance: RENT_MINIMUM,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(45),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(60),
            },
            {
                address: '3fGHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxDust02',
                balance: RENT_MINIMUM,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(67),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(85),
            },
            {
                address: '4jKLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxDust03',
                balance: RENT_MINIMUM,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(52),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(72),
            },
            {
                address: '6nPRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxDust04',
                balance: RENT_MINIMUM,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(38),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(50),
            },
            {
                address: '9qVXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxDust05',
                balance: RENT_MINIMUM,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(72),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(95),
            },
            {
                address: '1aWYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxDust06',
                balance: RENT_MINIMUM,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(41),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(55),
            },

            // PROTECTED (2 accounts) - User funds present
            {
                address: 'PrT1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxProt01',
                balance: 1.25000000,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(3),
                status: 'PROTECTED',
                detectedAt: daysAgo(28),
            },
            {
                address: 'PrT2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxProt02',
                balance: 0.42000000,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(7),
                status: 'PROTECTED',
                detectedAt: daysAgo(35),
            },

            // ACTIVE (2 accounts) - Too recent to reclaim
            {
                address: 'AcT1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxActv01',
                balance: RENT_MINIMUM,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(12),
                status: 'ACTIVE',
                detectedAt: daysAgo(18),
            },
            {
                address: 'AcT2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxActv02',
                balance: RENT_MINIMUM,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(8),
                status: 'ACTIVE',
                detectedAt: daysAgo(14),
            },

            // RECLAIMED (1 account) - Already processed
            {
                address: 'RcL1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxRclm01',
                balance: 0.00000000,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(95),
                status: 'RECLAIMED',
                detectedAt: daysAgo(140),
            },
        ],
    });

    // Add a log entry for the demo restoration
    await prisma.activityLog.create({
        data: {
            action: 'SCAN',
            account: '-',
            amount: 0,
            mode: 'SIMULATION',
            reason: 'Demo data restored - 14 sponsored accounts loaded for Simulation Mode',
        },
    });

    console.log('[DemoSeeder] Demo data restored: 14 accounts');
    return 14;
}
