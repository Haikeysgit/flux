/**
 * Flux (Kora Rent Guardian) - Scanner Module (The Detective)
 * 
 * This module is responsible for discovering accounts that were sponsored
 * (rent-paid) by the Kora operator. It scans the blockchain for transactions
 * where the operator was the fee payer for account creation.
 * 
 * WHY WE SCAN THIS WAY:
 * ─────────────────────
 * When a Kora node sponsors an account creation, the operator wallet pays:
 * 1. The transaction fee (~0.000005 SOL)
 * 2. The rent deposit (~0.00203928 SOL for a token account)
 * 
 * These sponsored accounts show up in the operator's transaction history
 * as outgoing SOL transfers. By scanning `getSignaturesForAddress`, we can
 * find all transactions involving the operator and then filter for account
 * creations where operator === payer.
 * 
 * LIMITATIONS:
 * - Public RPC nodes have rate limits and may not return full history
 * - For production, a dedicated RPC or indexer service is recommended
 * - This scanner is designed for demonstration and moderate-scale operations
 */

import {
    PublicKey,
    ParsedTransactionWithMeta,
    ParsedInstruction,
    ConfirmedSignatureInfo,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getConnection } from './solana';
import { prisma } from './prisma';
import { config } from './config';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Result of a single account discovery.
 */
export interface DiscoveredAccount {
    /** The account's public key address */
    address: string;
    /** Current SOL balance */
    balance: number;
    /** Minimum rent-exempt balance */
    rentExemptMin: number;
    /** When the account was created (from transaction timestamp) */
    createdAt: Date;
}

/**
 * Summary of a scan operation.
 */
export interface ScanResult {
    /** Whether the scan completed successfully */
    success: boolean;
    /** Number of new accounts discovered */
    newAccounts: number;
    /** Number of existing accounts updated */
    updatedAccounts: number;
    /** Total accounts now in database */
    totalAccounts: number;
    /** Any error message if scan failed */
    error?: string;
    /** Timestamp of the scan */
    timestamp: Date;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Maximum number of transaction signatures to fetch per request.
 * Higher values = more history but slower and may hit rate limits.
 */
const MAX_SIGNATURES_PER_BATCH = 100;

/**
 * System Program ID - used to identify account creation instructions.
 */
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

/**
 * Minimum rent-exempt balance for a basic account (approximately).
 * This is used as a fallback; actual value is fetched from chain.
 */
const DEFAULT_RENT_EXEMPT_MINIMUM = 0.00089088;

// ============================================
// MAIN SCANNER FUNCTION
// ============================================

/**
 * Scans the blockchain for accounts sponsored by the operator.
 * 
 * @description This is the primary "Detective" function. It works by:
 * 
 * 1. FETCH HISTORY: Gets recent transaction signatures for the operator wallet
 *    using `getSignaturesForAddress`. This returns all transactions where the
 *    operator was involved (as payer, signer, or account reference).
 * 
 * 2. PARSE TRANSACTIONS: For each signature, fetches the full parsed transaction
 *    and looks for `SystemProgram.createAccount` instructions where:
 *    - The `source` (payer) is the operator wallet
 *    - The `newAccount` is the sponsored account
 * 
 * 3. CHECK CURRENT STATE: For each discovered account, queries the current
 *    on-chain state (balance, rent-exempt minimum) to determine if it's
 *    still active or eligible for reclamation.
 * 
 * 4. UPDATE DATABASE: Stores/updates the account information in the local
 *    SQLite database for the dashboard and Judge module to use.
 * 
 * @param operatorPublicKey - The public key of the Kora operator wallet
 * @returns Promise<ScanResult> - Summary of what was found and updated
 * 
 * @example
 * ```typescript
 * const operatorKey = new PublicKey('YourOperatorPublicKey...');
 * const result = await scanForSponsoredAccounts(operatorKey);
 * console.log(`Found ${result.newAccounts} new sponsored accounts`);
 * ```
 * 
 * @throws Error if the RPC connection fails or operator key is invalid
 */
export async function scanForSponsoredAccounts(
    operatorPublicKey: PublicKey
): Promise<ScanResult> {
    const connection = getConnection();
    const timestamp = new Date();

    console.log(`[Scanner] Starting scan for operator: ${operatorPublicKey.toBase58()}`);

    try {
        // ──────────────────────────────────────────────────────────────────
        // STEP 1: Fetch transaction history for the operator wallet
        // ──────────────────────────────────────────────────────────────────
        // We use getSignaturesForAddress because it returns ALL transactions
        // where the operator was involved. This includes:
        // - Transactions where operator was the fee payer
        // - Transactions where operator received funds
        // - Transactions where operator's accounts were referenced
        // ──────────────────────────────────────────────────────────────────

        console.log('[Scanner] Fetching transaction signatures...');

        const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
            operatorPublicKey,
            { limit: MAX_SIGNATURES_PER_BATCH },
            'confirmed'
        );

        console.log(`[Scanner] Found ${signatures.length} recent transactions`);

        if (signatures.length === 0) {
            return {
                success: true,
                newAccounts: 0,
                updatedAccounts: 0,
                totalAccounts: await prisma.sponsoredAccount.count(),
                timestamp,
            };
        }

        // ──────────────────────────────────────────────────────────────────
        // STEP 2: Parse each transaction to find account creations
        // ──────────────────────────────────────────────────────────────────
        // We look for SystemProgram.createAccount instructions where the
        // operator is the payer. This indicates a sponsored account creation.
        // ──────────────────────────────────────────────────────────────────

        const discoveredAccounts: DiscoveredAccount[] = [];

        for (const sigInfo of signatures) {
            // Skip failed transactions - they didn't create accounts
            if (sigInfo.err) continue;

            try {
                const tx = await connection.getParsedTransaction(sigInfo.signature, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0,
                });

                if (!tx) continue;

                // Extract sponsored accounts from this transaction
                const accounts = await extractSponsoredAccounts(
                    tx,
                    operatorPublicKey.toBase58(),
                    sigInfo.blockTime ? new Date(sigInfo.blockTime * 1000) : new Date()
                );

                discoveredAccounts.push(...accounts);

            } catch (txError) {
                // Log but continue - individual transaction failures shouldn't stop the scan
                console.warn(`[Scanner] Failed to parse tx ${sigInfo.signature}:`, txError);
            }
        }

        console.log(`[Scanner] Discovered ${discoveredAccounts.length} sponsored accounts`);

        // ──────────────────────────────────────────────────────────────────
        // STEP 3: Update database with discovered accounts
        // ──────────────────────────────────────────────────────────────────
        // For each account, we either create a new record or update the
        // existing one with the latest on-chain state.
        // ──────────────────────────────────────────────────────────────────

        let newCount = 0;
        let updatedCount = 0;

        for (const account of discoveredAccounts) {
            const currentState = await getAccountCurrentState(account.address);

            const existing = await prisma.sponsoredAccount.findUnique({
                where: { address: account.address },
            });

            if (existing) {
                // Update existing account with latest state
                await prisma.sponsoredAccount.update({
                    where: { address: account.address },
                    data: {
                        balance: currentState.balance,
                        lastActivity: new Date(),
                        // Preserve status unless account is now closed (balance = 0)
                        status: currentState.balance === 0 ? 'RECLAIMED' : existing.status,
                    },
                });
                updatedCount++;
            } else {
                // Create new account record
                await prisma.sponsoredAccount.create({
                    data: {
                        address: account.address,
                        balance: currentState.balance,
                        rentExemptMin: currentState.rentExemptMin,
                        lastActivity: account.createdAt,
                        status: determineInitialStatus(currentState),
                        detectedAt: new Date(),
                    },
                });
                newCount++;
            }
        }

        // Log the scan action
        await prisma.activityLog.create({
            data: {
                action: 'SCAN',
                account: operatorPublicKey.toBase58(),
                amount: 0,
                mode: config.isMockMode ? 'SIMULATION' : 'REAL',
                reason: `Scan complete: ${newCount} new, ${updatedCount} updated`,
            },
        });

        const totalAccounts = await prisma.sponsoredAccount.count();

        console.log(`[Scanner] Scan complete: ${newCount} new, ${updatedCount} updated, ${totalAccounts} total`);

        return {
            success: true,
            newAccounts: newCount,
            updatedAccounts: updatedCount,
            totalAccounts,
            timestamp,
        };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Scanner] Scan failed:', errorMessage);

        return {
            success: false,
            newAccounts: 0,
            updatedAccounts: 0,
            totalAccounts: await prisma.sponsoredAccount.count(),
            error: errorMessage,
            timestamp,
        };
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extracts sponsored account addresses from a parsed transaction.
 * 
 * @description Looks for SystemProgram.createAccount or createAccountWithSeed
 * instructions where the source (payer) matches the operator. These are the
 * canonical patterns for sponsored account creation.
 * 
 * WHY THESE SPECIFIC INSTRUCTIONS:
 * - createAccount: Direct account creation, operator pays rent
 * - createAccountWithSeed: PDA-style creation, operator still pays rent
 * - We ignore transfer/allocate as those don't represent sponsorship
 * 
 * @param tx - The parsed transaction to analyze
 * @param operatorAddress - The operator's public key as base58 string
 * @param txTime - When the transaction occurred
 * @returns Array of discovered accounts
 */
async function extractSponsoredAccounts(
    tx: ParsedTransactionWithMeta,
    operatorAddress: string,
    txTime: Date
): Promise<DiscoveredAccount[]> {
    const accounts: DiscoveredAccount[] = [];
    const connection = getConnection();

    // Check both inner and outer instructions
    const instructions = tx.transaction.message.instructions;

    for (const instruction of instructions) {
        // Only process parsed instructions from System Program
        if (!('parsed' in instruction)) continue;

        const parsed = instruction as ParsedInstruction;

        if (parsed.program !== 'system') continue;

        const info = parsed.parsed?.info;
        if (!info) continue;

        // ──────────────────────────────────────────────────────────────────
        // Check for createAccount instruction
        // This is the primary pattern for sponsored account creation.
        // The 'source' field indicates who paid the rent (sponsor).
        // ──────────────────────────────────────────────────────────────────
        if (
            parsed.parsed.type === 'createAccount' &&
            info.source === operatorAddress
        ) {
            const newAccountAddress = info.newAccount as string;

            // Get current rent-exempt minimum for this account's size
            const rentExempt = await connection.getMinimumBalanceForRentExemption(
                info.space || 0
            );

            accounts.push({
                address: newAccountAddress,
                balance: (info.lamports as number) / LAMPORTS_PER_SOL,
                rentExemptMin: rentExempt / LAMPORTS_PER_SOL,
                createdAt: txTime,
            });

            console.log(`[Scanner] Found sponsored account: ${newAccountAddress}`);
        }

        // ──────────────────────────────────────────────────────────────────
        // Check for createAccountWithSeed instruction
        // Similar to createAccount but uses a seed for the address derivation.
        // Still counts as sponsorship if operator is the payer.
        // ──────────────────────────────────────────────────────────────────
        if (
            parsed.parsed.type === 'createAccountWithSeed' &&
            info.source === operatorAddress
        ) {
            const newAccountAddress = info.newAccount as string;

            const rentExempt = await connection.getMinimumBalanceForRentExemption(
                info.space || 0
            );

            accounts.push({
                address: newAccountAddress,
                balance: (info.lamports as number) / LAMPORTS_PER_SOL,
                rentExemptMin: rentExempt / LAMPORTS_PER_SOL,
                createdAt: txTime,
            });

            console.log(`[Scanner] Found sponsored account (seeded): ${newAccountAddress}`);
        }
    }

    return accounts;
}

/**
 * Gets the current on-chain state of an account.
 * 
 * @description Fetches the latest balance and calculates the rent-exempt
 * minimum. This is crucial for the Judge module to determine if an account
 * has user funds or is eligible for reclamation.
 * 
 * @param address - The account address to query
 * @returns Current balance and rent-exempt minimum
 */
async function getAccountCurrentState(address: string): Promise<{
    balance: number;
    rentExemptMin: number;
    exists: boolean;
}> {
    const connection = getConnection();

    try {
        const publicKey = new PublicKey(address);
        const accountInfo = await connection.getAccountInfo(publicKey);

        if (!accountInfo) {
            // Account has been closed or doesn't exist
            return {
                balance: 0,
                rentExemptMin: DEFAULT_RENT_EXEMPT_MINIMUM,
                exists: false,
            };
        }

        const rentExempt = await connection.getMinimumBalanceForRentExemption(
            accountInfo.data.length
        );

        return {
            balance: accountInfo.lamports / LAMPORTS_PER_SOL,
            rentExemptMin: rentExempt / LAMPORTS_PER_SOL,
            exists: true,
        };

    } catch (error) {
        console.warn(`[Scanner] Failed to get state for ${address}:`, error);
        return {
            balance: 0,
            rentExemptMin: DEFAULT_RENT_EXEMPT_MINIMUM,
            exists: false,
        };
    }
}

/**
 * Determines the initial status for a newly discovered account.
 * 
 * @description Sets a conservative initial status based on current balance.
 * The Judge module will perform full eligibility checks later.
 * 
 * STATUS LOGIC:
 * - If balance is 0, account is already closed/reclaimed
 * - If balance > rent minimum, user may have deposited funds (PROTECTED)
 * - Otherwise, mark as ACTIVE until Judge evaluates age
 * 
 * @param state - Current on-chain state of the account
 * @returns Initial status string
 */
function determineInitialStatus(state: {
    balance: number;
    rentExemptMin: number;
    exists: boolean;
}): string {
    if (!state.exists || state.balance === 0) {
        return 'RECLAIMED';
    }

    // If balance significantly exceeds rent minimum, user has funds
    // Using 1.5x as threshold to account for minor variations
    if (state.balance > state.rentExemptMin * 1.5) {
        return 'PROTECTED';
    }

    // Default to ACTIVE - Judge will evaluate age and other criteria
    return 'ACTIVE';
}

/**
 * Performs a mock scan for testing/demo purposes.
 * 
 * @description Returns simulated scan results without hitting the blockchain.
 * Used when in Mock Mode or for testing the dashboard.
 * 
 * @returns Mock scan result
 */
export async function performMockScan(): Promise<ScanResult> {
    console.log('[Scanner] Performing mock scan (no blockchain calls)');

    const totalAccounts = await prisma.sponsoredAccount.count();

    // Log the mock scan
    await prisma.activityLog.create({
        data: {
            action: 'SCAN',
            account: '-',
            amount: 0,
            mode: 'SIMULATION',
            reason: 'Mock scan completed (demo mode)',
        },
    });

    return {
        success: true,
        newAccounts: 0,
        updatedAccounts: 0,
        totalAccounts,
        timestamp: new Date(),
    };
}
