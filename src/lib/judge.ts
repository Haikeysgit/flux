/**
 * Flux (Kora Rent Guardian) - Judge Module (The Safety Filter)
 * 
 * This module is the CRITICAL safety layer that determines whether an account
 * is safe to reclaim. It implements a strict 4-step verification chain that
 * EVERY account must pass before being marked as eligible for reclamation.
 * 
 * SAFETY FIRST PHILOSOPHY:
 * ─────────────────────────
 * The Judge follows a "when in doubt, don't reclaim" principle. It's better
 * to leave some recoverable rent on the table than to accidentally close an
 * account that a user is still using. Each check is designed to catch a
 * specific type of "false positive" that could harm users.
 * 
 * THE 4-STEP VERIFICATION CHAIN:
 * ──────────────────────────────
 * 1. PROFIT CHECK: Is reclaiming even worth it? (balance > transaction fee)
 * 2. USER FUND CHECK: Does the account contain user-deposited funds?
 * 3. AGE CHECK: Is the account old enough to be considered abandoned?
 * 4. WHITELIST CHECK: Has the operator explicitly protected this account?
 * 
 * If ANY check fails, the account is NOT eligible for reclamation.
 */

import { prisma } from './prisma';
import { config, TX_FEE_LAMPORTS, LAMPORTS_PER_SOL } from './config';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Possible judgment outcomes for an account.
 */
export type JudgmentStatus =
    | 'ELIGIBLE'   // Safe to reclaim
    | 'SKIP'       // Not worth reclaiming (unprofitable)
    | 'PROTECTED'  // Contains user funds, do not touch
    | 'ACTIVE'     // Too recent, may still be in use
    | 'WHITELISTED'; // Explicitly protected by operator

/**
 * Result of judging an account's eligibility for reclamation.
 */
export interface JudgmentResult {
    /** The final verdict */
    status: JudgmentStatus;

    /** Human-readable explanation of why this decision was made */
    reason: string;

    /** Which check caused the rejection (if not eligible) */
    failedCheck?: 'PROFIT' | 'USER_FUNDS' | 'AGE' | 'WHITELIST';

    /** The account address that was judged */
    address: string;

    /** Current balance of the account */
    balance: number;

    /** Potential SOL to recover if reclaimed */
    potentialRecovery: number;
}

/**
 * Account data structure from the database.
 */
export interface AccountForJudgment {
    address: string;
    balance: number;
    rentExemptMin: number;
    lastActivity: Date;
    status: string;
}

/**
 * Operator settings that affect judgment.
 */
export interface JudgmentSettings {
    /** Minimum age in days before an account is considered abandoned */
    minAgeDays: number;

    /** Whether we're in dry-run mode (affects logging only) */
    dryRunMode: boolean;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Default minimum age (in days) before an account is considered abandoned.
 * This is a conservative default - operators can adjust via settings.
 */
const DEFAULT_MIN_AGE_DAYS = 30;

/**
 * Transaction fee in SOL (approximately 0.000005 SOL).
 * Accounts with less than this aren't worth reclaiming.
 */
const TX_FEE_SOL = TX_FEE_LAMPORTS / LAMPORTS_PER_SOL;

/**
 * Tolerance factor for user fund detection.
 * If balance exceeds rent minimum by this factor, user has deposited funds.
 * 
 * WHY 1.01 (1%)?
 * Small rounding variations can occur in rent calculations. We use a 1%
 * tolerance to avoid false positives from these variations while still
 * catching any meaningful user deposits.
 */
const USER_FUND_TOLERANCE = 1.01;

// ============================================
// MAIN JUDGE FUNCTION
// ============================================

/**
 * Evaluates whether an account is safe to reclaim.
 * 
 * @description This is the CRITICAL safety function that prevents the bot
 * from accidentally closing active user accounts. Every account MUST pass
 * ALL FOUR checks to be marked as ELIGIBLE for reclamation.
 * 
 * THE VERIFICATION CHAIN (in order):
 * 
 * 1. **PROFIT CHECK**: Is the balance worth reclaiming?
 *    - If balance <= transaction fee (~0.000005 SOL), we'd lose money
 *    - Result: SKIP with reason explaining unprofitability
 * 
 * 2. **USER FUND CHECK**: Does the account have user-deposited funds?
 *    - If balance > rentExemptMin * 1.01, user has added their own SOL
 *    - Result: PROTECTED - we MUST NOT close accounts with user money
 * 
 * 3. **AGE CHECK**: Is the account old enough to be considered abandoned?
 *    - If lastActivity < minAgeDays (default 30), account may be in use
 *    - Result: ACTIVE - wait longer before reclaiming
 * 
 * 4. **WHITELIST CHECK**: Has the operator protected this account?
 *    - Operators can whitelist addresses they never want to reclaim
 *    - Result: WHITELISTED - respect operator's explicit protection
 * 
 * @param account - The account to evaluate
 * @param settings - Operator settings (min age, etc.)
 * @param whitelist - List of whitelisted addresses
 * @returns JudgmentResult with status and detailed reason
 * 
 * @example
 * ```typescript
 * const result = await judgeAccount(account, settings, whitelist);
 * if (result.status === 'ELIGIBLE') {
 *   console.log(`Can reclaim ${result.potentialRecovery} SOL`);
 * } else {
 *   console.log(`Cannot reclaim: ${result.reason}`);
 * }
 * ```
 */
export function judgeAccount(
    account: AccountForJudgment,
    settings: JudgmentSettings,
    whitelist: string[]
): JudgmentResult {
    const { address, balance, rentExemptMin, lastActivity } = account;

    // Calculate potential recovery (balance minus transaction fee)
    const potentialRecovery = Math.max(0, balance - TX_FEE_SOL);

    // ──────────────────────────────────────────────────────────────────
    // CHECK 1: PROFIT CHECK
    // ──────────────────────────────────────────────────────────────────
    // Is it even worth reclaiming this account?
    // If the balance is less than the transaction fee, we'd actually
    // LOSE money by trying to reclaim it. Skip these accounts entirely.
    // ──────────────────────────────────────────────────────────────────

    if (balance <= TX_FEE_SOL) {
        return {
            status: 'SKIP',
            reason: `Skipped: Balance (${balance.toFixed(9)} SOL) is less than transaction fee (${TX_FEE_SOL} SOL) - not profitable to reclaim`,
            failedCheck: 'PROFIT',
            address,
            balance,
            potentialRecovery: 0,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // CHECK 2: USER FUND CHECK
    // ──────────────────────────────────────────────────────────────────
    // Does this account contain user-deposited funds?
    // If the balance exceeds the rent-exempt minimum, the user has added
    // their own SOL to this account. We MUST NOT close these accounts
    // as it would steal user funds - this is a CRITICAL safety check.
    // ──────────────────────────────────────────────────────────────────

    if (balance > rentExemptMin * USER_FUND_TOLERANCE) {
        const excessFunds = balance - rentExemptMin;
        return {
            status: 'PROTECTED',
            reason: `Protected: Balance (${balance.toFixed(6)} SOL) exceeds rent minimum (${rentExemptMin.toFixed(6)} SOL) by ${excessFunds.toFixed(6)} SOL - account contains user funds`,
            failedCheck: 'USER_FUNDS',
            address,
            balance,
            potentialRecovery,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // CHECK 3: AGE CHECK
    // ──────────────────────────────────────────────────────────────────
    // Is this account old enough to be considered abandoned?
    // Recently created or recently active accounts should not be reclaimed
    // even if they only have the rent deposit. The user may still be
    // setting up or actively using the account.
    // ──────────────────────────────────────────────────────────────────

    const accountAgeMs = Date.now() - lastActivity.getTime();
    const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
    const minAgeDays = settings.minAgeDays || DEFAULT_MIN_AGE_DAYS;

    if (accountAgeDays < minAgeDays) {
        const daysRemaining = Math.ceil(minAgeDays - accountAgeDays);
        return {
            status: 'ACTIVE',
            reason: `Active: Account age (${Math.floor(accountAgeDays)} days) is less than minimum (${minAgeDays} days) - wait ${daysRemaining} more days`,
            failedCheck: 'AGE',
            address,
            balance,
            potentialRecovery,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // CHECK 4: WHITELIST CHECK
    // ──────────────────────────────────────────────────────────────────
    // Has the operator explicitly protected this account?
    // Operators may have business reasons to never reclaim certain accounts
    // (e.g., partner accounts, test accounts, special integrations).
    // ──────────────────────────────────────────────────────────────────

    if (whitelist.includes(address)) {
        return {
            status: 'WHITELISTED',
            reason: `Whitelisted: Account is explicitly protected by operator - will never be reclaimed`,
            failedCheck: 'WHITELIST',
            address,
            balance,
            potentialRecovery,
        };
    }

    // ──────────────────────────────────────────────────────────────────
    // ALL CHECKS PASSED - ELIGIBLE FOR RECLAMATION
    // ──────────────────────────────────────────────────────────────────
    // If we reach here, the account has passed all safety checks:
    // ✓ Has enough balance to be worth reclaiming
    // ✓ Does not contain user funds
    // ✓ Is old enough to be considered abandoned
    // ✓ Is not explicitly protected by the operator
    // ──────────────────────────────────────────────────────────────────

    return {
        status: 'ELIGIBLE',
        reason: `Eligible: Account passed all safety checks - ${accountAgeDays.toFixed(0)} days old, balance equals rent minimum, ready to reclaim ${potentialRecovery.toFixed(6)} SOL`,
        address,
        balance,
        potentialRecovery,
    };
}

// ============================================
// BATCH JUDGMENT FUNCTIONS
// ============================================

/**
 * Judges all accounts in the database and updates their status.
 * 
 * @description Runs the judgment process on all accounts, updating their
 * status in the database. This is useful for periodic re-evaluation as
 * accounts age and become eligible over time.
 * 
 * @returns Summary of judgment results
 */
export async function judgeAllAccounts(): Promise<{
    total: number;
    eligible: number;
    protected: number;
    active: number;
    skipped: number;
    whitelisted: number;
}> {
    // Load settings from database
    const settings = await getJudgmentSettings();

    // Load whitelist
    const whitelistEntries = await prisma.whitelist.findMany();
    const whitelist = whitelistEntries.map(w => w.address);

    // Load all accounts that aren't already reclaimed
    const accounts = await prisma.sponsoredAccount.findMany({
        where: {
            status: { not: 'RECLAIMED' },
        },
    });

    const results = {
        total: accounts.length,
        eligible: 0,
        protected: 0,
        active: 0,
        skipped: 0,
        whitelisted: 0,
    };

    for (const account of accounts) {
        const judgment = judgeAccount(account, settings, whitelist);

        // Update account status in database
        await prisma.sponsoredAccount.update({
            where: { address: account.address },
            data: { status: judgment.status },
        });

        // Count results
        switch (judgment.status) {
            case 'ELIGIBLE':
                results.eligible++;
                break;
            case 'PROTECTED':
                results.protected++;
                break;
            case 'ACTIVE':
                results.active++;
                break;
            case 'SKIP':
                results.skipped++;
                break;
            case 'WHITELISTED':
                results.whitelisted++;
                break;
        }

        console.log(`[Judge] ${account.address}: ${judgment.status} - ${judgment.reason}`);
    }

    return results;
}

/**
 * Gets all accounts that are eligible for reclamation.
 * 
 * @description Convenience function that returns only accounts that have
 * passed all safety checks and are ready to be reclaimed.
 * 
 * @returns Array of eligible accounts with their judgment results
 */
export async function getEligibleAccounts(): Promise<JudgmentResult[]> {
    const settings = await getJudgmentSettings();
    const whitelistEntries = await prisma.whitelist.findMany();
    const whitelist = whitelistEntries.map(w => w.address);

    const accounts = await prisma.sponsoredAccount.findMany({
        where: {
            status: { not: 'RECLAIMED' },
        },
    });

    const eligible: JudgmentResult[] = [];

    for (const account of accounts) {
        const judgment = judgeAccount(account, settings, whitelist);
        if (judgment.status === 'ELIGIBLE') {
            eligible.push(judgment);
        }
    }

    return eligible;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Loads judgment settings from the database.
 * 
 * @returns Current judgment settings
 */
export async function getJudgmentSettings(): Promise<JudgmentSettings> {
    const minAgeSetting = await prisma.settings.findUnique({
        where: { key: 'min_age_days' },
    });

    const dryRunSetting = await prisma.settings.findUnique({
        where: { key: 'dry_run_mode' },
    });

    return {
        minAgeDays: minAgeSetting ? parseInt(minAgeSetting.value, 10) : DEFAULT_MIN_AGE_DAYS,
        dryRunMode: dryRunSetting ? dryRunSetting.value === 'true' : true,
    };
}

/**
 * Updates a judgment setting in the database.
 * 
 * @param key - Setting key to update
 * @param value - New value
 */
export async function updateJudgmentSetting(
    key: 'min_age_days' | 'dry_run_mode',
    value: string
): Promise<void> {
    await prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
    });

    console.log(`[Judge] Setting updated: ${key} = ${value}`);
}

/**
 * Adds an address to the whitelist.
 * 
 * @param address - Address to protect
 * @param note - Optional note explaining why
 */
export async function addToWhitelist(
    address: string,
    note?: string
): Promise<void> {
    await prisma.whitelist.upsert({
        where: { address },
        update: { note },
        create: { address, note },
    });

    // Also update the account status if it exists
    await prisma.sponsoredAccount.updateMany({
        where: { address },
        data: { status: 'WHITELISTED' },
    });

    console.log(`[Judge] Added to whitelist: ${address}`);
}

/**
 * Removes an address from the whitelist.
 * 
 * @param address - Address to unprotect
 */
export async function removeFromWhitelist(address: string): Promise<void> {
    await prisma.whitelist.delete({
        where: { address },
    }).catch(() => {
        // Ignore if not found
    });

    console.log(`[Judge] Removed from whitelist: ${address}`);
}
