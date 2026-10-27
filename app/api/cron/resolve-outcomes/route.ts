import { NextRequest, NextResponse } from 'next/server';
import { runAutoResolution } from '@/lib/ledger/auto-resolution';

export async function GET(_request: NextRequest) {
  try {
    const summary = await runAutoResolution();
    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('[AutoResolution Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Auto-resolution failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let feedByTicker = {};
    try {
      const body = await request.json();
      if (body?.feedByTicker) {
        feedByTicker = body.feedByTicker;
      }
    } catch {
      // Empty body is valid
    }

    const summary = await runAutoResolution(feedByTicker);
    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('[AutoResolution Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Auto-resolution failed',
      },
      { status: 500 }
    );
  }
}
