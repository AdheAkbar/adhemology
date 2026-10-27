-- Migration: 019_prediction_ledger.sql
-- Adimology Verified Intelligence V6 - Phase 2: Prediction Ledger & Detached Outcomes
-- Purpose: Provide an immutable append-only audit trail of predictions before outcome resolution,
-- paired with detached outcome tracking and barrier precedence evaluation.

-- 1. Predictions Table (Write-Once / Append-Only)
CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ticker VARCHAR(16) NOT NULL,
    as_of_date TIMESTAMPTZ NOT NULL,
    horizon VARCHAR(32) NOT NULL, -- e.g. INTRADAY_5M, INTRADAY_15M, INTRADAY_60M, DAILY_SWING, WEEKLY
    price_at_prediction NUMERIC NOT NULL,
    target_price NUMERIC NOT NULL,
    invalidation_price NUMERIC NOT NULL,
    legacy_adimology_target NUMERIC,
    time_stop_date TIMESTAMPTZ NOT NULL,
    score_raw NUMERIC,
    prob_calibrated NUMERIC,
    quality_status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED, DEGRADED, PROVISIONAL, SYNTHETIC
    capability_snapshot JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indices for efficient time-series and ticker queries
CREATE INDEX IF NOT EXISTS idx_predictions_ticker_date ON predictions(ticker, as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_horizon ON predictions(horizon);
CREATE INDEX IF NOT EXISTS idx_predictions_quality ON predictions(quality_status);

-- 2. Prediction Outcomes Table (Detached Resolution)
CREATE TABLE IF NOT EXISTS prediction_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE RESTRICT,
    resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome_status VARCHAR(32) NOT NULL, -- TARGET_FIRST, INVALIDATION_FIRST, TIME_STOP, NO_FILL, CANCELLED
    outcome_price NUMERIC NOT NULL,
    return_pct NUMERIC NOT NULL,
    mfe NUMERIC NOT NULL, -- Maximum Favorable Excursion (%)
    mae NUMERIC NOT NULL, -- Maximum Adverse Excursion (%)
    bars_to_outcome INTEGER NOT NULL DEFAULT 0,
    audit_log JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT uq_prediction_outcome UNIQUE(prediction_id)
);

CREATE INDEX IF NOT EXISTS idx_outcomes_status ON prediction_outcomes(outcome_status);
CREATE INDEX IF NOT EXISTS idx_outcomes_resolved_at ON prediction_outcomes(resolved_at DESC);

-- 3. Immutability Enforcement
-- Predictions must never be updated or deleted once recorded.
CREATE OR REPLACE FUNCTION prevent_prediction_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Table "predictions" is immutable. Prediction records cannot be updated after insertion.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Table "predictions" is immutable. Prediction records cannot be deleted from the audit ledger.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_predictions ON predictions;
CREATE TRIGGER trg_immutable_predictions
    BEFORE UPDATE OR DELETE ON predictions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_prediction_mutation();

-- Documentation Comments
COMMENT ON TABLE predictions IS 'Immutable ledger of predictions generated before outcome resolution.';
COMMENT ON TABLE prediction_outcomes IS 'Detached outcomes resolved via barrier precedence (TARGET_FIRST, INVALIDATION_FIRST, TIME_STOP).';
COMMENT ON COLUMN predictions.legacy_adimology_target IS 'Original Adimology target_realistis preserved as a baseline benchmark control.';
COMMENT ON COLUMN prediction_outcomes.mfe IS 'Maximum Favorable Excursion percentage reached during the prediction horizon.';
COMMENT ON COLUMN prediction_outcomes.mae IS 'Maximum Adverse Excursion percentage reached during the prediction horizon.';
