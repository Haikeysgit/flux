/**
 * Flux (Kora Rent Guardian) - Executioner Module (The Reclaimer)
 * 
 * This module handles the actual reclamation of rent SOL from eligible accounts.
 * It operates in two distinct modes to ensure safety:
 * 
 * DUAL-MODE OPERATION:
 * ────────────────────
 * 1. SIMULATION MODE (dry_run = true):
 *    - Does NOT sign or broadcast any transactions
 *    - Logs what WOULD happen if executed for real
 *    - Perfect for testing and demonstration
 *    - This is the DEFAULT mode for safety
 * 
 * 2. REAL MODE (dry_run = false):
 *    - Signs and broadcasts closeAccount transactions
 *    - Records transaction signatures for audit trail
 *    - Transfers rent SOL back to operator treasury
 *    - Only enabled when operator explicitly toggles it
 * 
 * SECURITY GUARANTEES:
 * ────────────────────
 * - The operator's private key is ONLY accessed in this file
 * - The private key is NEVER logged to console
 * - The private key is NEVER sent to the browser/client
 * - If no key is configured, all operations run in simulation
 * 
 * TRANSACTION PATTERN:
 * ────────────────────
 * To reclaim rent from an account, we close it using the appropriate
 * instruction based on the account type:
 * - Token accounts: Use TokenProgram.closeAccount
 * - System accounts: Transfer remaining balance to operator
 */

import {
    PublicKey,
    Transaction,
    SystemProgram,
    Keypair,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getConnection, getExplorerUrl } from './solana';
import { prisma } from './prisma';
import { config, TX_FEE_LAMPORTS } from './config';
import { judgeAccount, getJudgmentSettings, type JudgmentResult } from './judge';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Result of a reclaim operation.
 */
export interface ReclaimResult {
    /** Whether the operation succeeded */
    success: boolean;

    /** The account address that was processed */
    address: string;

    /** Execution mode: REAL or SIMULATION */
    mode: 'REAL' | 'SIMULATION';

    /** Amount of SOL reclaimed (or that would be reclaimed) */
    amount: number;

    /** Transaction signature (only for REAL mode) */
    txSignature?: string;

    /** Explorer URL for the transaction (only for REAL mode) */
    explorerUrl?: string;

    /** Human-readable message about the result */
    message: string;

    /** Error message if operation failed */
    error?: string;
}

/**
 * Summary of a batch reclaim operation.
 */
export interface BatchReclaimResult {
    /** Total accounts processed */
    total: number;

    /** Number of successful reclaims */
    successful: number;

    /** Number of failed reclaims */
    failed: number;

    /** Total SOL reclaimed (or simulated) */
    totalReclaimed: number;

    /** Execution mode */
    mode: 'REAL' | 'SIMULATION';

    /** Individual results for each account */
    results: ReclaimResult[];
}

// ============================================
// MAIN RECLAIM FUNCTION
// ============================================

/**
 * Reclaims rent from a single eligible account.
 * 
 * @description This is the core reclamation function. It handles both
 * simulation and real execution based on the dryRun parameter.
 * 
 * OPERATION FLOW:
 * 
 * 1. VALIDATE: Re-run the Judge to ensure account is still eligible
 *    (Status may have changed since last scan)
 * 
 * 2. SIMULATE OR EXECUTE:
 *    - If dryRun=true: Log what would happen, return simulation result
 *    - If dryRun=false: Build, sign, and broadcast the transaction
 * 
 * 3. UPDATE DATABASE:
 *    - Mark account as RECLAIMED
 *    - Create ActivityLog entry with full details
 * 
 * SECURITY NOTES:
 * ───────────────
 * - The operator's private key is loaded from process.env
 * - If no key is present, the function forces simulation mode
 * - The private key is NEVER logged or included in return values
 * 
 * @param address - The account address to reclaim
 * @param dryRun - If true, simulate only (no real transaction)
 * @returns ReclaimResult with success status and details
 * 
 * @example
 * ```typescript
 * // Simulation mode (safe for testing)
 * const simResult = await reclaimAccount('SomeAddress...', true);
 * console.log(simResult.message); // "Simulation: Would reclaim 0.002 SOL"
 * 
 * // Real mode (requires OPERATOR_PRIVATE_KEY)
 * const realResult = await reclaimAccount('SomeAddress...', false);
 * console.log(realResult.txSignature); // "5xyz..."
 * ```
 */
export async function reclaimAccount(
    address: string,
    dryRun: boolean = true
): Promise<ReclaimResult> {
    console.log(`[Executioner] Processing: ${address} (mode: ${dryRun ? 'SIMULATION' : 'REAL'})`);

    try {
        // ──────────────────────────────────────────────────────────────────
        // STEP 1: Validate the account is still eligible
        // ──────────────────────────────────────────────────────────────────
        // Re-run the Judge to ensure the account hasn't changed since
        // we last evaluated it. This prevents race conditions where an
        // account becomes active between evaluation and reclamation.
        // ──────────────────────────────────────────────────────────────────

        const account = await prisma.sponsoredAccount.findUnique({
            where: { address },
        });

        if (!account) {
            return {
                success: false,
                address,
                mode: dryRun ? 'SIMULATION' : 'REAL',
                amount: 0,
                message: 'Account not found in database',
                error: 'ACCOUNT_NOT_FOUND',
            };
        }

        // Re-validate with Judge
        const settings = await getJudgmentSettings();
        const whitelistEntries = await prisma.whitelist.findMany();
        const whitelist = whitelistEntries.map(w => w.address);

        const judgment = judgeAccount(account, settings, whitelist);

        if (judgment.status !== 'ELIGIBLE') {
            // Log the skip
            await prisma.activityLog.create({
                data: {
                    action: 'SKIP',
                    account: address,
                    amount: account.balance,
                    mode: dryRun ? 'SIMULATION' : 'REAL',
                    reason: judgment.reason,
                },
            });

            return {
                success: false,
                address,
                mode: dryRun ? 'SIMULATION' : 'REAL',
                amount: 0,
                message: `Cannot reclaim: ${judgment.reason}`,
                error: judgment.status,
            };
        }

        // ──────────────────────────────────────────────────────────────────
        // STEP 2A: SIMULATION MODE
        // ──────────────────────────────────────────────────────────────────
        // If dryRun is true, we just log what would happen without
        // actually signing or broadcasting any transaction. This is
        // the safe default for testing and demonstration.
        // ──────────────────────────────────────────────────────────────────

        if (dryRun) {
            console.log(`[Executioner] SIMULATION: Would reclaim ${account.balance} SOL from ${address}`);

            // Log the simulated reclaim
            await prisma.activityLog.create({
                data: {
                    action: 'RECLAIM',
                    account: address,
                    amount: judgment.potentialRecovery,
                    mode: 'SIMULATION',
                    reason: `Simulation: Would reclaim ${judgment.potentialRecovery.toFixed(6)} SOL`,
                },
            });

            return {
                success: true,
                address,
                mode: 'SIMULATION',
                amount: judgment.potentialRecovery,
                message: `Simulation Success: Would reclaim ${judgment.potentialRecovery.toFixed(6)} SOL from ${address}`,
            };
        }

        // ──────────────────────────────────────────────────────────────────
        // STEP 2B: REAL MODE - Requires Private Key
        // ──────────────────────────────────────────────────────────────────
        // For real execution, we need the operator's private key to sign
        // the transaction. If no key is configured, we force simulation.
        // ──────────────────────────────────────────────────────────────────

        if (!config.operatorPrivateKey) {
            console.warn('[Executioner] No private key configured - falling back to simulation');

            return {
                success: false,
                address,
                mode: 'SIMULATION',
                amount: 0,
                message: 'Cannot execute real transaction: OPERATOR_PRIVATE_KEY not configured',
                error: 'NO_PRIVATE_KEY',
            };
        }

        // ──────────────────────────────────────────────────────────────────
        // STEP 3: Build and sign the transaction
        // ──────────────────────────────────────────────────────────────────
        // We create a simple transfer instruction that moves all remaining
        // SOL from the target account back to the operator. For token
        // accounts, a more complex closeAccount flow would be needed.
        // 
        // NOTE: This is a simplified implementation. Full production use
        // would need to handle different account types (token accounts,
        // PDAs, etc.) with their specific close authority requirements.
        // ──────────────────────────────────────────────────────────────────

        const connection = getConnection();

        // Decode the operator's private key (NEVER log this!)
        const operatorKeypair = Keypair.fromSecretKey(
            bs58.decode(config.operatorPrivateKey)
        );

        const targetPubkey = new PublicKey(address);
        const operatorPubkey = operatorKeypair.publicKey;

        // Get current balance in lamports
        const balanceLamports = await connection.getBalance(targetPubkey);

        if (balanceLamports === 0) {
            // Account already empty
            await prisma.sponsoredAccount.update({
                where: { address },
                data: { status: 'RECLAIMED', balance: 0 },
            });

            return {
                success: true,
                address,
                mode: 'REAL',
                amount: 0,
                message: 'Account already empty - marked as reclaimed',
            };
        }

        // Calculate transfer amount (leave nothing behind)
        const transferAmount = balanceLamports - TX_FEE_LAMPORTS;

        if (transferAmount <= 0) {
            return {
                success: false,
                address,
                mode: 'REAL',
                amount: 0,
                message: 'Balance too low to cover transaction fee',
                error: 'INSUFFICIENT_BALANCE',
            };
        }

        // Build the transaction
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: targetPubkey,
                toPubkey: operatorPubkey,
                lamports: transferAmount,
            })
        );

        // Sign and send
        console.log(`[Executioner] Sending transaction to reclaim ${transferAmount / LAMPORTS_PER_SOL} SOL...`);

        const txSignature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [operatorKeypair], // Signer
            { commitment: 'confirmed' }
        );

        console.log(`[Executioner] Transaction confirmed: ${txSignature}`);

        // ──────────────────────────────────────────────────────────────────
        // STEP 4: Update database
        // ──────────────────────────────────────────────────────────────────

        const reclaimedAmount = transferAmount / LAMPORTS_PER_SOL;

        // Mark account as reclaimed
        await prisma.sponsoredAccount.update({
            where: { address },
            data: {
                status: 'RECLAIMED',
                balance: 0,
                lastActivity: new Date(),
            },
        });

        // Log the reclaim with transaction signature
        await prisma.activityLog.create({
            data: {
                action: 'RECLAIM',
                account: address,
                amount: reclaimedAmount,
                mode: 'REAL',
                txSignature,
                reason: `Successfully reclaimed ${reclaimedAmount.toFixed(6)} SOL`,
            },
        });

        const explorerUrl = getExplorerUrl(txSignature, 'tx');

        return {
            success: true,
            address,
            mode: 'REAL',
            amount: reclaimedAmount,
            txSignature,
            explorerUrl,
            message: `Success: Reclaimed ${reclaimedAmount.toFixed(6)} SOL from ${address}`,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Executioner] Failed to reclaim ${address}:`, errorMessage);

        // Log the failure
        await prisma.activityLog.create({
            data: {
                action: 'SKIP',
                account: address,
                amount: 0,
                mode: dryRun ? 'SIMULATION' : 'REAL',
                reason: `Error: ${errorMessage}`,
            },
        });

        return {
            success: false,
            address,
            mode: dryRun ? 'SIMULATION' : 'REAL',
            amount: 0,
            message: `Failed to reclaim: ${errorMessage}`,
            error: errorMessage,
        };
    }
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Reclaims rent from all eligible accounts.
 * 
 * @description Iterates through all accounts marked as ELIGIBLE and
 * attempts to reclaim each one. Respects the dryRun setting.
 * 
 * @param dryRun - If true, simulate all operations
 * @returns BatchReclaimResult with summary and individual results
 */
export async function reclaimAllEligible(
    dryRun: boolean = true
): Promise<BatchReclaimResult> {
    console.log(`[Executioner] Starting batch reclaim (mode: ${dryRun ? 'SIMULATION' : 'REAL'})`);

    // Get all eligible accounts
    const eligibleAccounts = await prisma.sponsoredAccount.findMany({
        where: { status: 'ELIGIBLE' },
    });

    const results: ReclaimResult[] = [];
    let totalReclaimed = 0;
    let successful = 0;
    let failed = 0;

    for (const account of eligibleAccounts) {
        const result = await reclaimAccount(account.address, dryRun);
        results.push(result);

        if (result.success) {
            successful++;
            totalReclaimed += result.amount;
        } else {
            failed++;
        }

        // Small delay between transactions to avoid rate limiting
        if (!dryRun) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log(`[Executioner] Batch complete: ${successful}/${eligibleAccounts.length} successful, ${totalReclaimed.toFixed(6)} SOL reclaimed`);

    return {
        total: eligibleAccounts.length,
        successful,
        failed,
        totalReclaimed,
        mode: dryRun ? 'SIMULATION' : 'REAL',
        results,
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Checks if real mode execution is available.
 * 
 * @description Returns true only if the operator's private key is
 * configured. Used by the UI to determine whether to show the
 * "Real Mode" toggle.
 * 
 * @returns Whether real transactions can be executed
 */
export function isRealModeAvailable(): boolean {
    return !config.isMockMode && !!config.operatorPrivateKey;
}

/**
 * Gets the current dry_run_mode setting from the database.
 * 
 * @returns Whether dry run mode is enabled
 */
export async function isDryRunEnabled(): Promise<boolean> {
    const setting = await prisma.settings.findUnique({
        where: { key: 'dry_run_mode' },
    });

    // Default to true (safe)
    return setting ? setting.value === 'true' : true;
}

/**
 * Toggles the dry_run_mode setting.
 * 
 * @param enabled - Whether to enable dry run mode
 */
export async function setDryRunMode(enabled: boolean): Promise<void> {
    await prisma.settings.upsert({
        where: { key: 'dry_run_mode' },
        update: { value: enabled.toString() },
        create: { key: 'dry_run_mode', value: enabled.toString() },
    });

    console.log(`[Executioner] Dry run mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

/**
 * Gets statistics about recoverable rent.
 * 
 * @returns Summary of potential and actual reclaimed amounts
 */
export async function getReclaimStats(): Promise<{
    totalRecovered: number;
    potentialRecovery: number;
    eligibleCount: number;
    protectedCount: number;
    activeCount: number;
}> {
    const accounts = await prisma.sponsoredAccount.findMany();

    let totalRecovered = 0;
    let potentialRecovery = 0;
    let eligibleCount = 0;
    let protectedCount = 0;
    let activeCount = 0;

    // Sum up reclaimed amounts from activity logs
    const reclaimLogs = await prisma.activityLog.findMany({
        where: {
            action: 'RECLAIM',
            mode: 'REAL',
        },
    });

    for (const log of reclaimLogs) {
        totalRecovered += log.amount;
    }

    // Calculate potential recovery from current eligible accounts
    for (const account of accounts) {
        switch (account.status) {
            case 'ELIGIBLE':
                eligibleCount++;
                potentialRecovery += Math.max(0, account.balance - (TX_FEE_LAMPORTS / LAMPORTS_PER_SOL));
                break;
            case 'PROTECTED':
                protectedCount++;
                break;
            case 'ACTIVE':
                activeCount++;
                break;
        }
    }

    return {
        totalRecovered,
        potentialRecovery,
        eligibleCount,
        protectedCount,
        activeCount,
    };
}
