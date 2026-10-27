import { NextRequest, NextResponse } from 'next/server';
import {
  computeModelCalibration,
  saveCalibrationSnapshot,
  getLatestCalibration,
  listCalibrationSnapshots,
  detectCalibrationDrift,
} from '@/lib/calibration';
import { listPredictions } from '@/lib/ledger';
import type { TradingHorizon, PredictionOutcomePair } from '@/lib/calibration/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const horizon = (searchParams.get('horizon') as TradingHorizon) || 'DAILY_SWING';
  const showHistory = searchParams.get('history') === 'true';

  try {
    if (showHistory) {
      const history = await listCalibrationSnapshots(horizon);
      return NextResponse.json({ success: true, data: history });
    }

    const latest = await getLatestCalibration(horizon);
    if (!latest) {
      return NextResponse.json({
        success: true,
        data: null,
        message: `No active calibration found for horizon: ${horizon}`,
      });
    }

    return NextResponse.json({ success: true, data: latest });
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
    const action = body.action || 'recalibrate';
    const horizon = (body.horizon as TradingHorizon) || 'DAILY_SWING';

    if (action === 'recalibrate') {
      let pairs: PredictionOutcomePair[] = body.pairs;

      // If pairs not provided directly in body, gather from resolved predictions in the ledger
      if (!pairs || !Array.isArray(pairs)) {
        const ledgerResults = await listPredictions({
          horizon,
          hasOutcome: true,
          limit: 1000,
        });

        pairs = ledgerResults.items
          .filter((item) => item.outcome && item.prediction.prob_calibrated != null)
          .map((item) => ({
            predicted_prob: item.prediction.prob_calibrated!,
            actual_outcome: item.outcome!.outcome_status === 'TARGET_FIRST' ? 1 : 0,
          }));
      }

      if (!pairs || pairs.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient historical resolved setups in ledger for horizon: ${horizon} to recalibrate.`,
          },
          { status: 400 }
        );
      }

      const calibration = computeModelCalibration(horizon, pairs, {
        modelName: body.model_name || 'ADIMOLOGY_CALIBRATED_V6',
        metadata: body.metadata,
      });

      const saved = await saveCalibrationSnapshot(calibration);

      return NextResponse.json({ success: true, data: saved }, { status: 201 });
    }

    if (action === 'drift_check') {
      const history = await listCalibrationSnapshots(horizon);
      if (history.length < 2) {
        return NextResponse.json({
          success: true,
          data: {
            has_drift: false,
            severity: 'NONE',
            description: 'Insufficient historical calibration snapshots (need at least 2) for drift analysis.',
          },
        });
      }

      const current = history[0];
      const baseline = history[1];
      const drift = detectCalibrationDrift(current, baseline);

      return NextResponse.json({ success: true, data: drift });
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
