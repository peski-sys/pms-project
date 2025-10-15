import { NextRequest, NextResponse } from 'next/server'
import { updateMarketSnapshotsLTP } from '@/lib/marketSnapshotAutoUpdate'

/**
 * POST /api/update-ltp
 * Manually trigger LTP updates for market snapshots
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Manual LTP update triggered via API')
    await updateMarketSnapshotsLTP()
    
    return NextResponse.json({ 
      success: true, 
      message: 'LTP update completed successfully' 
    })
  } catch (error) {
    console.error('Error in manual LTP update:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to update LTP data',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/update-ltp
 * Alternative GET method for manual LTP updates (for easier browser testing)
 */
export async function GET(request: NextRequest) {
  return POST(request)
}