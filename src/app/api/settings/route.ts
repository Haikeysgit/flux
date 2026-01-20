/**
 * Flux API - Settings Endpoint
 * GET /api/settings - Returns current settings
 * PUT /api/settings - Updates a setting
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { config } from '@/lib/config';

export async function GET() {
    try {
        const settings = await prisma.settings.findMany();

        // Convert to key-value object
        const settingsMap: Record<string, string> = {};
        for (const setting of settings) {
            settingsMap[setting.key] = setting.value;
        }

        return NextResponse.json({
            success: true,
            settings: settingsMap,
            isMockMode: config.isMockMode,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch settings';
        console.error('[API/settings] Error:', message);

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { key, value } = body as { key: string; value: string };

        if (!key || value === undefined) {
            return NextResponse.json(
                { success: false, error: 'Both "key" and "value" are required' },
                { status: 400 }
            );
        }

        // Validate allowed keys
        const allowedKeys = ['min_age_days', 'dry_run_mode'];
        if (!allowedKeys.includes(key)) {
            return NextResponse.json(
                { success: false, error: `Invalid setting key. Allowed: ${allowedKeys.join(', ')}` },
                { status: 400 }
            );
        }

        // Upsert the setting
        await prisma.settings.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) },
        });

        console.log(`[API/settings] Updated: ${key} = ${value}`);

        return NextResponse.json({
            success: true,
            key,
            value: String(value),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update settings';
        console.error('[API/settings] Error:', message);

        return NextResponse.json(
            { success: false, error: message },
            { status: 500 }
        );
    }
}
