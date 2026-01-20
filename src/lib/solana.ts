/**
 * Flux (Kora Rent Guardian) - Solana Connection Module
 * 
 * This module provides a singleton Solana connection instance and
 * utility functions for interacting with the Solana blockchain.
 * 
 * NETWORK STRATEGY:
 * - Defaults to Devnet for safe prototyping
 * - Can be switched to Mainnet via SOLANA_RPC_URL environment variable
 * - All operations are read-only except for the Executioner's reclaim transactions
 */

import { Connection, clusterApiUrl } from '@solana/web3.js';
import { config, NETWORKS } from './config';

/**
 * Singleton connection instance to avoid creating multiple connections.
 * Reused across all modules for efficiency.
 */
let connectionInstance: Connection | null = null;

/**
 * Gets or creates a Solana RPC connection.
 * 
 * @description Uses a singleton pattern to ensure we don't create
 * multiple connections, which would waste resources and potentially
 * hit rate limits on public RPC endpoints.
 * 
 * @returns The Solana Connection instance
 * 
 * @example
 * ```typescript
 * const connection = getConnection();
 * const balance = await connection.getBalance(publicKey);
 * ```
 */
export function getConnection(): Connection {
    if (!connectionInstance) {
        const rpcUrl = config.rpcUrl || NETWORKS.DEVNET;

        connectionInstance = new Connection(rpcUrl, {
            commitment: 'confirmed',
            // Disable WebSocket for simpler operation
            wsEndpoint: undefined,
        });

        console.log(`[Solana] Connected to: ${rpcUrl}`);
    }

    return connectionInstance;
}

/**
 * Resets the connection instance.
 * Useful for testing or when switching networks.
 */
export function resetConnection(): void {
    connectionInstance = null;
}

/**
 * Gets the Solana Explorer URL for a transaction or account.
 * 
 * @param signature - Transaction signature or account address
 * @param type - Type of entity ('tx' for transaction, 'address' for account)
 * @returns The Solana Explorer URL
 * 
 * @example
 * ```typescript
 * const url = getExplorerUrl('abc123...', 'tx');
 * // Returns: https://explorer.solana.com/tx/abc123...?cluster=devnet
 * ```
 */
export function getExplorerUrl(
    signature: string,
    type: 'tx' | 'address' = 'tx'
): string {
    const baseUrl = 'https://explorer.solana.com';
    const cluster = config.rpcUrl.includes('mainnet') ? '' : '?cluster=devnet';

    return `${baseUrl}/${type}/${signature}${cluster}`;
}

export default getConnection;
