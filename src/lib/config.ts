/**
 * Flux (Kora Rent Guardian) - Configuration Module
 * 
 * Central configuration with environment variable handling and Mock Mode fallback.
 * 
 * CRITICAL DESIGN DECISION:
 * If no OPERATOR_PRIVATE_KEY is set, the app enters "Mock Mode" where:
 * - The dashboard works with demo data from the seed
 * - No real Solana transactions are attempted
 * - This allows judges to see the UI immediately without configuration
 * 
 * SECURITY NOTE:
 * The private key is ONLY accessed server-side and is NEVER:
 * - Logged to console
 * - Sent to the browser/client
 * - Included in error messages
 */

/**
 * Solana network configuration constants.
 */
export const NETWORKS = {
    DEVNET: 'https://api.devnet.solana.com',
    MAINNET: 'https://api.mainnet-beta.solana.com',
} as const;

/**
 * Transaction fee in lamports (approximately 0.000005 SOL).
 * Used by the Judge module to determine if reclamation is profitable.
 */
export const TX_FEE_LAMPORTS = 5000;

/**
 * Number of lamports per SOL (1 billion).
 */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Application configuration object.
 * Centralizes all environment-dependent settings.
 */
export const config = {
    /**
     * Solana RPC endpoint URL.
     * Defaults to Devnet for safe prototyping.
     */
    rpcUrl: process.env.SOLANA_RPC_URL || NETWORKS.DEVNET,

    /**
     * Operator's private key for signing transactions.
     * If not set, the app runs in Mock Mode.
     * 
     * IMPORTANT: This is accessed ONLY on the server side.
     */
    operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY || null,

    /**
     * Operator's public key (wallet address).
     * Used for identifying sponsored accounts.
     */
    operatorPublicKey: process.env.OPERATOR_PUBLIC_KEY || null,

    /**
     * Whether the app is running in Mock Mode.
     * True when no operator key is configured.
     */
    get isMockMode(): boolean {
        return !this.operatorPrivateKey;
    },

    /**
     * Transaction fee in SOL (for display and calculations).
     */
    txFeeSol: TX_FEE_LAMPORTS / LAMPORTS_PER_SOL,

    /**
     * Database URL (SQLite file path).
     */
    databaseUrl: process.env.DATABASE_URL || 'file:./prisma/local.db',
} as const;

/**
 * Validates that the configuration is safe to use for real transactions.
 * Call this before any real (non-simulation) operations.
 * 
 * @throws Error if configuration is incomplete for real mode
 */
export function validateRealModeConfig(): void {
    if (config.isMockMode) {
        throw new Error(
            'Cannot perform real transactions in Mock Mode. ' +
            'Set OPERATOR_PRIVATE_KEY environment variable to enable real mode.'
        );
    }

    if (!config.operatorPublicKey) {
        throw new Error(
            'OPERATOR_PUBLIC_KEY is required for real mode. ' +
            'Please set this environment variable.'
        );
    }
}

/**
 * Returns a safe version of the config for client-side use.
 * NEVER includes private key or sensitive data.
 */
export function getClientSafeConfig() {
    return {
        isMockMode: config.isMockMode,
        rpcUrl: config.rpcUrl,
        operatorPublicKey: config.operatorPublicKey,
        txFeeSol: config.txFeeSol,
    };
}

export default config;
