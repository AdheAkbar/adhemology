-- Migration: 020_calibration_tables.sql
-- Adimology Verified Intelligence V6 - Phase 4: Model Calibrations & Decile Reliability Metrics
-- Purpose: Persist historical calibration metrics, decile reliability curves, and drift tracking.

CREATE TABLE IF NOT EXISTS model_calibrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(64) NOT NULL DEFAULT 'ADIMOLOGY_CALIBRATED_V6',
    horizon VARCHAR(32) NOT NULL, -- INTRADAY_5M, INTRADAY_15M, INTRADAY_60M, DAILY_SWING, WEEKLY
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sample_size INTEGER NOT NULL,
    brier_score NUMERIC NOT NULL,
    brier_skill_score NUMERIC,
    ece NUMERIC NOT NULL, -- Expected Calibration Error
    log_loss NUMERIC,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_calibrations_horizon_active ON model_calibrations(horizon, is_active);
CREATE INDEX IF NOT EXISTS idx_calibrations_computed_at ON model_calibrations(computed_at DESC);

-- Decile Reliability Curve Table
CREATE TABLE IF NOT EXISTS calibration_deciles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calibration_id UUID NOT NULL REFERENCES model_calibrations(id) ON DELETE CASCADE,
    decile_index INTEGER NOT NULL, -- 1 to 10
    bin_min NUMERIC NOT NULL,
    bin_max NUMERIC NOT NULL,
    mean_predicted_prob NUMERIC NOT NULL,
    observed_win_rate NUMERIC NOT NULL,
    sample_count INTEGER NOT NULL,
    calibration_gap NUMERIC NOT NULL,
    CONSTRAINT uq_calibration_decile UNIQUE(calibration_id, decile_index)
);

CREATE INDEX IF NOT EXISTS idx_calibration_deciles_cal_id ON calibration_deciles(calibration_id);

COMMENT ON TABLE model_calibrations IS 'Snapshots of empirical model calibration metrics (Brier score, ECE, log loss).';
COMMENT ON TABLE calibration_deciles IS 'Binned decile reliability points for plotting calibration curves vs the 45-degree diagonal.';
