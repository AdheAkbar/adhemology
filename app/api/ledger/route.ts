import { NextRequest, NextResponse } from 'next/server';
import {
  recordPrediction,
  resolveOutcome,
  getPrediction,
  listPredictions,
  evaluateBarrierPrecedence,
} from '@/lib/ledger/prediction-ledger';
import type {
  LedgerInsertPayload,
  ResolutionPayload,
  TradingHorizon,
  QualityStatus,
  OutcomeStatus,
  CandleBar,
} from '@/lib/ledger/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (id) {
    const record = await getPrediction(id);
    if (!record) {
      return NextResponse.json(
        { success: false, error: `Prediction "${id}" not found` },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: record });
  }

  const ticker = searchParams.get('ticker') || undefined;
  const horizon = (searchParams.get('horizon') as TradingHorizon) || undefined;
  const quality_status = (searchParams.get('quality_status') as QualityStatus) || undefined;
  const outcome_status = (searchParams.get('outcome_status') as OutcomeStatus) || undefined;
  const hasOutcomeParam = searchParams.get('hasOutcome');
  const hasOutcome =
    hasOutcomeParam === 'true' ? true : hasOutcomeParam === 'false' ? false : undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
  const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

  try {
    const result = await listPredictions({
      ticker,
      horizon,
      quality_status,
      outcome_status,
      hasOutcome,
      limit,
      offset,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'record';

    if (action === 'record') {
      const payload = body.payload as LedgerInsertPayload;
      if (!payload || !payload.ticker || !payload.price_at_prediction || !payload.target_price || !payload.invalidation_price) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required prediction fields (ticker, price_at_prediction, target_price, invalidation_price, horizon)',
          },
          { status: 400 }
        );
      }

      const prediction = await recordPrediction(payload);
      return NextResponse.json({ success: true, data: prediction }, { status: 201 });
    }

    if (action === 'resolve') {
      const predictionId = body.prediction_id;
      if (!predictionId) {
        return NextResponse.json(
          { success: false, error: 'Missing prediction_id for resolution' },
          { status: 400 }
        );
      }

      // Check if resolving via price candle bars
      if (Array.isArray(body.bars)) {
        const found = await getPrediction(predictionId);
        if (!found) {
          return NextResponse.json(
            { success: false, error: `Prediction "${predictionId}" not found` },
            { status: 404 }
          );
        }

        const barrierResult = evaluateBarrierPrecedence(
          found.prediction,
          body.bars as CandleBar[],
          body.options || {}
        );

        const outcome = await resolveOutcome(predictionId, {
          outcome_status: barrierResult.outcome_status,
          outcome_price: barrierResult.outcome_price,
          return_pct: barrierResult.return_pct,
          mfe: barrierResult.mfe,
          mae: barrierResult.mae,
          bars_to_outcome: barrierResult.bars_to_outcome,
          audit_log: {
            resolution_reason: barrierResult.resolution_reason,
            resolved_bar_date: barrierResult.resolved_bar_date,
            highest_price: barrierResult.highest_price,
            lowest_price: barrierResult.lowest_price,
          },
        });

        return NextResponse.json({
          success: true,
          data: outcome,
          barrier_evaluation: barrierResult,
        });
      }

      // Direct outcome resolution
      const outcomePayload = body.outcome as ResolutionPayload;
      if (!outcomePayload || !outcomePayload.outcome_status || outcomePayload.outcome_price == null) {
        return NextResponse.json(
          { success: false, error: 'Missing outcome payload fields (outcome_status, outcome_price, mfe, mae)' },
          { status: 400 }
        );
      }

      const outcome = await resolveOutcome(predictionId, outcomePayload);
      return NextResponse.json({ success: true, data: outcome });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: "${action}"` },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
