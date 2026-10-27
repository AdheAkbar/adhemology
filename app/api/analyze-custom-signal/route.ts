import { NextRequest, NextResponse } from 'next/server';
import { analyzeCustomSignal, SignalType } from '@/lib/ai-story';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawText, emiten, signalType, fromDate, toDate } = body;

    if (!rawText || !rawText.trim()) {
      return NextResponse.json(
        { success: false, error: 'Silakan masukkan teks sinyal atau berita yang ingin dianalisa.' },
        { status: 400 }
      );
    }

    const result = await analyzeCustomSignal({
      rawText,
      emiten: emiten ? emiten.trim().toUpperCase() : undefined,
      signalType: (signalType as SignalType) || 'SIGNAL',
      fromDate,
      toDate,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Analyze Custom Signal API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Terjadi kesalahan saat menganalisis sinyal.',
      },
      { status: 500 }
    );
  }
}
