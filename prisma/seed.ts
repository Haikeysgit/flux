/**
 * Flux (Kora Rent Guardian) - Database Seed Script
 * 
 * This script populates the database with demo data for Mock Mode.
 * It runs automatically on `npm run dev` to ensure judges can see
 * a working dashboard immediately without any configuration.
 * 
 * REALISTIC DATA DISTRIBUTION:
 * - "Dust" accounts (0.002 SOL): Standard rent deposits, majority of accounts
 * - "Mid-tier" accounts (0.05 SOL): Occasional larger deposits
 * - "Whale" account (0.85 SOL): One high-value abandoned account
 * 
 * This "long tail" distribution looks authentic to experienced Solana developers
 * while still triggering the Large Idle Rent alert (>0.5 SOL threshold).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Standard rent-exempt minimum for token accounts
const RENT_MINIMUM = 0.00203928;

async function main() {
    console.log('[Seed] Initializing Flux database with realistic demo data...');

    // Clear existing data for idempotent seeding
    await prisma.activityLog.deleteMany();
    await prisma.sponsoredAccount.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.whitelist.deleteMany();

    // ============================================
    // DEFAULT SETTINGS
    // ============================================
    await prisma.settings.createMany({
        data: [
            { key: 'min_age_days', value: '30' },
            { key: 'dry_run_mode', value: 'true' },
        ],
    });
    console.log('[Seed] Created default settings');

    // ============================================
    // DEMO SPONSORED ACCOUNTS
    // ============================================
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    await prisma.sponsoredAccount.createMany({
        data: [
            // ========================================
            // THE WHALE (1 account) - Drives alert trigger
            // ========================================
            {
                address: '8xKVzxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxWhale1',
                balance: 0.85000000,
                rentExemptMin: RENT_MINIMUM,
                lastActivity: daysAgo(92),
                status: 'ELIGIBLE',
                detectedAt: daysAgo(120),
            },

            // ========================================
            // MID-TIER (2 accounts) - Moderate deposits
            // ========================================
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

            // ========================================
            // THE DUST (6 accounts) - Standard rent deposits
            // ========================================
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

            // ========================================
            // PROTECTED (2 accounts) - User funds present
            // ========================================
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

            // ========================================
            // ACTIVE (2 accounts) - Too recent to reclaim
            // ========================================
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

            // ========================================
            // RECLAIMED (1 account) - Already processed
            // ========================================
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

    // Total eligible: 0.85 + 0.052 + 0.048 + (6 * 0.00203928) = ~0.962 SOL
    console.log('[Seed] Created 14 demo sponsored accounts');

    // ============================================
    // DEMO ACTIVITY LOG
    // ============================================
    await prisma.activityLog.createMany({
        data: [
            {
                action: 'SCAN',
                account: '-',
                amount: 0,
                mode: 'SIMULATION',
                reason: 'Blockchain scan completed - discovered 14 sponsored accounts',
                timestamp: daysAgo(1),
            },
            {
                action: 'SKIP',
                account: 'PrT1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxProt01',
                amount: 1.25,
                mode: 'SIMULATION',
                reason: 'Protected: Balance (1.25 SOL) exceeds rent minimum - account contains user funds',
                timestamp: daysAgo(1),
            },
            {
                action: 'SKIP',
                account: 'AcT1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxActv01',
                amount: RENT_MINIMUM,
                mode: 'SIMULATION',
                reason: 'Active: Account age (12 days) is less than minimum (30 days) - wait 18 more days',
                timestamp: daysAgo(1),
            },
            {
                action: 'RECLAIM',
                account: 'RcL1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxRclm01',
                amount: 0.00203928,
                mode: 'SIMULATION',
                reason: 'Simulation Success: Would reclaim 0.002039 SOL from dormant account',
                txSignature: null,
                timestamp: daysAgo(0.5),
            },
        ],
    });
    console.log('[Seed] Created demo activity logs');

    // ============================================
    // DEMO WHITELIST
    // ============================================
    await prisma.whitelist.create({
        data: {
            address: 'WhtLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxWhLst1',
            note: 'Partner integration account - protected from reclamation',
        },
    });
    console.log('[Seed] Created demo whitelist entry');

    console.log('');
    console.log('[Seed] Database seeded successfully');
    console.log('[Seed] Realistic Distribution:');
    console.log('       - 1 WHALE account (0.85 SOL)');
    console.log('       - 2 MID-TIER accounts (~0.10 SOL total)');
    console.log('       - 6 DUST accounts (~0.012 SOL total)');
    console.log('       - Total ELIGIBLE: ~0.96 SOL across 9 accounts');
    console.log('       - 2 PROTECTED, 2 ACTIVE, 1 RECLAIMED');
    console.log('');
    console.log('[Seed] Large Idle Alert will trigger (threshold: 0.5 SOL)');
}

main()
    .catch((e) => {
        console.error('[Seed] Failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
