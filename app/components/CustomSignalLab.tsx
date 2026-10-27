'use client';

import React, { useState } from 'react';
import type { CustomSignalAnalysisResult, SignalType } from '@/lib/ai-story/custom-signal-analyzer';

const SAMPLE_PRESETS = [
  {
    label: '🏦 Sinyal BMRI (Akumulasi ZP)',
    type: 'SIGNAL' as SignalType,
    emiten: 'BMRI',
    text: 'Sinyal Beli BMRI di area 4380 - 4390. Target jangka pendek 4420. Terpantau broker asing ZP terus melakukan akumulasi konsisten dan harga saat ini masih berada di bawah rata-rata modal bandar.',
  },
  {
    label: '📈 Berita BBCA (Katalis Fundamental)',
    type: 'NEWS' as SignalType,
    emiten: 'BBCA',
    text: 'Kredit BBCA bertumbuh double digit didorong ekspansi kredit korporasi dan konsumer yang solid. Rasio NPL terjaga di level prima 1.8% dan CASA mencapai 80%. Direksi optimis dividen interim akan dibagikan akhir kuartal.',
  },
  {
    label: '⚠️ Pom-pom BRIS (Peringatan Distribusi)',
    type: 'RUMOR' as SignalType,
    emiten: 'BRIS',
    text: 'ALERT BUY BRIS! Info A1 grup pasar modal, target tembus 2000 pekan ini karena rumor merger bank syariah regional. Ayo serok sekarang sebelum ketinggalan roket!',
  },
];

export default function CustomSignalLab() {
  const [rawText, setRawText] = useState('');
  const [manualEmiten, setManualEmiten] = useState('');
  const [signalType, setSignalType] = useState<SignalType>('SIGNAL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomSignalAnalysisResult | null>(null);

  const handleApplyPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    setRawText(preset.text);
    setManualEmiten(preset.emiten);
    setSignalType(preset.type);
    setError(null);
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rawText.trim()) {
      setError('Silakan ketik atau paste teks berita / sinyal yang ingin dianalisa.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/analyze-custom-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          emiten: manualEmiten ? manualEmiten.trim().toUpperCase() : undefined,
          signalType,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menganalisa sinyal.');
      }

      setResult(json.data);
    } catch (err: any) {
      console.error('Signal analysis error:', err);
      setError(err.message || 'Terjadi kesalahan sistem saat menganalisa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          padding: '2rem',
          borderRadius: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.8rem',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)',
            }}
          >
            📡
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc' }}>
              Sinyal & Berita AI Lab
            </h1>
            <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
              Kirim sinyal Telegram, berita media, atau rumor saham. Adimology V6 akan otomatis memvalidasi apakah klaim berita sejalan dengan akumulasi riil bandar atau justru jebakan retail (pom-pom).
            </p>
          </div>
        </div>

        {/* Preset Chips */}
        <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Coba Contoh Cepat:</span>
          {SAMPLE_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(p)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#e2e8f0',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Section */}
      <div
        className="glass-card"
        style={{
          marginBottom: '2rem',
          padding: '1.75rem',
          borderRadius: '16px',
        }}
      >
        <form onSubmit={handleAnalyze}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>
              📝 Masukkan Teks Sinyal, Berita, atau Rumor:
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste pesan Telegram, berita koran/online, atau sinyal trading Anda di sini. Contoh: 'Sinyal beli BMRI target 4500 karena asing terus akumulasi...' "
              rows={5}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                fontSize: '0.95rem',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            {/* Emiten Override */}
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                Kode Saham (Otomatis / Manual):
              </label>
              <input
                type="text"
                value={manualEmiten}
                onChange={(e) => setManualEmiten(e.target.value.toUpperCase())}
                placeholder="Kosongkan jika di dalam teks (Contoh: BMRI)"
                maxLength={6}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Signal Type Selector */}
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                Kategori Konten:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['SIGNAL', 'NEWS', 'RUMOR'] as SignalType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSignalType(t)}
                    style={{
                      flex: 1,
                      padding: '0.65rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: signalType === t ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: signalType === t ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      color: signalType === t ? '#60a5fa' : '#94a3b8',
                      transition: 'all 0.2s',
                    }}
                  >
                    {t === 'SIGNAL' ? '🎯 Sinyal' : t === 'NEWS' ? '📰 Berita' : '🕵️ Rumor'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.9rem',
                marginBottom: '1.25rem',
              }}
            >
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.9rem 2rem',
              borderRadius: '12px',
              background: loading ? 'rgba(59, 130, 246, 0.5)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '1rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 15px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: '18px', height: '18px' }}></span>
                Membedah Sinyal & Mengambil Data Broker...
              </>
            ) : (
              <>
                ⚡ Analisa Sinyal & Berita Sekarang
              </>
            )}
          </button>
        </form>
      </div>

      {/* Results Section */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', marginBottom: '3rem' }}>
          {/* Verdict Banner */}
          <div
            className="glass-card"
            style={{
              padding: '1.75rem',
              borderRadius: '16px',
              border: `1px solid ${
                result.verdict_color === 'success'
                  ? '#10b981'
                  : result.verdict_color === 'danger'
                  ? '#ef4444'
                  : result.verdict_color === 'warning'
                  ? '#f59e0b'
                  : '#3b82f6'
              }`,
              background:
                result.verdict_color === 'success'
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(15, 23, 42, 0.8))'
                  : result.verdict_color === 'danger'
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(15, 23, 42, 0.8))'
                  : result.verdict_color === 'warning'
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(15, 23, 42, 0.8))'
                  : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(15, 23, 42, 0.8))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#e2e8f0',
                  }}
                >
                  HASIL VERIFIKASI KUANTITATIF {result.emiten}
                </span>
                <h2
                  style={{
                    margin: '0.5rem 0 0.5rem',
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    color:
                      result.verdict_color === 'success'
                        ? '#34d399'
                        : result.verdict_color === 'danger'
                        ? '#f87171'
                        : result.verdict_color === 'warning'
                        ? '#fbbf24'
                        : '#60a5fa',
                  }}
                >
                  {result.verdict_label}
                </h2>
                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.5, maxWidth: '850px' }}>
                  {result.summary_reason}
                </p>
              </div>

              <div
                style={{
                  textAlign: 'center',
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '1rem 1.5rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                  Skor Validasi
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>
                  {result.verdict_score}
                  <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/100</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#38ef7d', marginTop: '0.25rem' }}>
                  Probabilitas: {result.target_ladder.calibrated_win_prob}%
                </div>
              </div>
            </div>
          </div>

          {/* Microstructure Reality Check Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {/* Box 1: Reality vs Claim */}
            <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '14px' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏦 Realitas Aliran Uang Bandar
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Bandar Utama:</span>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{result.reality_check.bandar_code} ({result.reality_check.bandar_lots.toLocaleString()} lot)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Harga Modal Bandar:</span>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>Rp {result.reality_check.bandar_avg_cost.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Harga Pasar Saat Ini:</span>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>Rp {result.reality_check.market_price.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Deviasi dari Modal Bandar:</span>
                  <span style={{ fontWeight: 600, color: result.reality_check.price_vs_bandar_pct <= 0 ? '#38ef7d' : '#f59e0b' }}>
                    {result.reality_check.price_vs_bandar_pct >= 0 ? `+${result.reality_check.price_vs_bandar_pct}%` : `${result.reality_check.price_vs_bandar_pct}%`}
                    {result.reality_check.price_vs_bandar_pct <= 0 ? ' (Area Diskon)' : ' (Di atas modal)'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Status Rezim Flow:</span>
                  <span style={{ fontWeight: 600, color: result.reality_check.adi >= 0 ? '#38ef7d' : '#ef4444' }}>
                    {result.reality_check.flow_regime} (ADI: {result.reality_check.adi})
                  </span>
                </div>
              </div>
            </div>

            {/* Box 2: Target & Invalidation Levels */}
            <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '14px' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#38ef7d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎯 Target & Proteksi Risiko (V6)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Target Realistis (T1):</span>
                  <span style={{ fontWeight: 600, color: '#38ef7d' }}>Rp {result.target_ladder.t1_realistic.toLocaleString()} (+{result.target_ladder.t1_gain_pct}%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Target Lanjutan (T2):</span>
                  <span style={{ fontWeight: 600, color: '#60a5fa' }}>Rp {result.target_ladder.t2_stretch.toLocaleString()} (+{result.target_ladder.t2_gain_pct}%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Invalidation (Stop Loss):</span>
                  <span style={{ fontWeight: 600, color: '#f87171' }}>Rp {result.target_ladder.invalidation.toLocaleString()} (-{result.target_ladder.risk_pct}%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Risk-Reward Ratio (RRR):</span>
                  <span style={{ fontWeight: 600, color: result.target_ladder.is_rrr_valid ? '#38ef7d' : '#f87171' }}>
                    1 : {result.target_ladder.rrr} {result.target_ladder.is_rrr_valid ? '(Valid ≥ 1.5x)' : '(Sub-optimal)'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Likuiditas Eksekusi:</span>
                  <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{result.reality_check.liquidity_rating}</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights & Tactical Plan */}
          <div className="glass-card" style={{ padding: '1.75rem', borderRadius: '16px' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🧠 Analisis Mendalam AI Story & Tindakan Taktis
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
              {/* Katalis & Risiko */}
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38ef7d', marginBottom: '0.4rem' }}>
                    ✨ Katalis Kunci Terdeteksi:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    {result.ai_insights.catalysts_identified.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f87171', marginBottom: '0.4rem' }}>
                    ⚠️ Risiko Tersembunyi:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    {result.ai_insights.hidden_risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Plan Box */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.75rem' }}>
                  📋 Rencana Aksi Eksekusi ({result.ai_insights.recommended_action.action}):
                </div>
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <strong style={{ color: '#94a3b8' }}>Area Masuk (Entry):</strong>{' '}
                    <span style={{ color: '#f8fafc' }}>{result.ai_insights.recommended_action.entry_range}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#94a3b8' }}>Target Ambil Untung:</strong>{' '}
                    <span style={{ color: '#38ef7d' }}>{result.ai_insights.recommended_action.take_profit}</span>
                  </div>
                  <div>
                    <strong style={{ color: '#94a3b8' }}>Batas Rugi (Stop Loss):</strong>{' '}
                    <span style={{ color: '#f87171' }}>{result.ai_insights.recommended_action.stop_loss}</span>
                  </div>
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1', lineHeight: 1.5 }}>
                    <strong>Saran Taktis:</strong> {result.ai_insights.recommended_action.tactical_advice}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
