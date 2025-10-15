import { NextResponse } from 'next/server'
import { updateMarketSnapshotsLTP } from '@/lib/marketSnapshotAutoUpdate'

export async function GET() {
    try {
        console.log('Manual market snapshots update triggered via API')
        await updateMarketSnapshotsLTP()

        return NextResponse.json({
            success: true,
            message: 'Market snapshots updated successfully',
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('Market snapshots update API error:', error)
        
        return NextResponse.json({
            success: false,
            message: 'Failed to update market snapshots',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 })
    }
}

export async function POST() {
    // Same functionality for POST requests
    return GET()
}