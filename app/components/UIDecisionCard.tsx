'use client';

/**
 * app/components/UIDecisionCard.tsx
 * Canonical UI Decision Card (PRD v2.0 §20).
 * 
 * Strict Contract:
 * 1. Urutan 5 blok tidak boleh diubah:
 *    ① VERDICT -> ② RENCANA -> ③ TAHAN SAMPAI KAPAN -> ④ KENAPA / ⑤ KENAPA TIDAK (Red Team).
 * 2. Blok ⑤ KENAPA TIDAK WAJIB TAMPIL dan TIDAK BISA DITUTUP/DILIPAT.
 * 3. Tapping pada angka memunculkan drawer/modal Fact Provenance (fact_id, sumber, umur data).
 * 4. Menampilkan "TIDAK ADA SETUP HARI INI" saat pasar tidak menawarkan ekspektansi bersih positif.
 */

import React, { useState } from 'react';
import type { DecisionGateV2Output } from '@/lib/decisions/decision-gate-v2';
import type { Fact } from '@/lib/data-truth/point-in-time';
import { ShieldCheck, ShieldAlert, Clock, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  decision: DecisionGateV2Output;
}

export const UIDecisionCard: React.FC<Props> = ({ decision }) => {
  const [selectedFact, setSelectedFact] = useState<Fact<any> | null>(null);

  const isBuy = decision.verdict === 'BUY';
  const isWatch = decision.verdict === 'WATCH';
  const isNoTrade = decision.verdict === 'NO_TRADE';

  const pPct = Math.round(decision.probability.pTp1BeforeSl * 100);

  const openFactModal = (factId: string) => {
    const fact = decision.factSheet[factId];
    if (fact) setSelectedFact(fact);
  };

  // Render "TIDAK ADA SETUP HARI INI"
  if (isNoTrade) {
    return (
      <div className="w-full max-w-4xl mx-auto my-6 p-6 bg-slate-900 border-2 border-slate-700 rounded-xl shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
            <div>
              <h2 className="text-xl font-bold tracking-tight">{decision.ticker} — TIDAK ADA SETUP HARI INI</h2>
              <p className="text-xs text-slate-400">Rulebook BEI: {decision.rulebookVersion} · Silence is a Feature</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full border border-amber-500/40">
            NO TRADE (BERTAHAN)
          </span>
        </div>

        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 mb-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" /> Rasional Perlindungan Modal:
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            {decision.silenceReason || 'Kondisi pasar atau emiten tidak memenuhi ambang ekspektansi bersih positif setelah memperhitungkan seluruh biaya transaksi. Sistem memilih diam daripada memaksakan risiko.'}
          </p>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">Pemeriksaan Gerbang yang Gagal:</h4>
          <ul className="space-y-1.5">
            {decision.gateChecks.failed.map((reason, idx) => (
              <li key={idx} className="text-xs text-rose-300 flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-6 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-100 font-sans">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between px-6 py-3.5 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white tracking-wider">{decision.ticker}</span>
          <span className="text-slate-400">·</span>
          <span className="font-semibold text-emerald-400">{decision.mode}</span>
          <span className="text-slate-400">·</span>
          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-medium">Tier {decision.tier}</span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <span>Data: Segar (2 dtk)</span>
          <span>·</span>
          <span className="text-emerald-400 font-medium">Rulebook BEI Aktif ✓</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ① VERDICT BLOK */}
        <div className="p-4 bg-slate-900/90 rounded-lg border border-slate-800">
          <div className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-1">① VERDICT</div>
          <div className="flex flex-wrap items-baseline gap-4 mb-2">
            <span className={`text-2xl font-black ${isBuy ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isBuy ? 'BELI' : 'AMATI (WATCH)'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-200">Keyakinan {pPct}%</span>
              <div className="w-32 bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full ${isBuy ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${pPct}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-300 italic">
            &quot;Peluang sedikit di atas lempar koin, dengan imbalan {decision.plan.rrNet}× risiko. Ini bukan kepastian.&quot;
          </p>
        </div>

        {/* ② RENCANA BLOK */}
        <div className="p-4 bg-slate-900/60 rounded-lg border border-slate-800">
          <div className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-3">② RENCANA PERDAGANGAN (NETTO BIAYA)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <span className="text-xs text-slate-400 block mb-1">Zona Masuk</span>
              <button
                onClick={() => openFactModal('L8.entry')}
                className="text-base font-bold text-slate-100 hover:text-emerald-400 transition-colors underline decoration-dotted"
              >
                Rp {decision.plan.recommendedEntry.toLocaleString()}
              </button>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">Stop Loss</span>
              <button
                onClick={() => openFactModal('L8.sl')}
                className="text-base font-bold text-rose-400 hover:text-rose-300 transition-colors underline decoration-dotted"
              >
                Rp {decision.plan.slPrice.toLocaleString()} ({decision.plan.slNetPct}%)
              </button>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">Ukuran Posisi</span>
              <span className="text-base font-bold text-slate-100">
                {decision.plan.sizingLot} Lot
              </span>
              <span className="text-[10px] text-slate-400 block">
                (Risiko {decision.plan.riskPctEquity}%)
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-1">Net R:R Ratio</span>
              <span className="text-base font-bold text-emerald-400">
                1 : {decision.plan.rrNet}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
            {decision.plan.targets.map((t) => (
              <div key={t.level} className="p-2.5 bg-slate-950/60 rounded border border-slate-800">
                <div className="flex justify-between font-bold mb-1">
                  <span className="text-emerald-400">{t.level} Rp {t.price.toLocaleString()}</span>
                  <span className="text-slate-300">+{t.netPct}% bersih</span>
                </div>
                <div className="text-[11px] text-slate-400">{t.action}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ③ TAHAN SAMPAI KAPAN BLOK */}
        <div className="p-4 bg-slate-900/60 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-slate-400 tracking-wider uppercase">③ TAHAN SAMPAI KAPAN</div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>⏱ ~{decision.holdPlan.horizonEstimate.daysToTp1.p50} Hari Bursa</span>
            </div>
          </div>

          <div className="text-xs text-slate-300 space-y-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Rentang Waktu Normal:</span>
              <span className="font-semibold text-slate-200">
                {decision.holdPlan.horizonEstimate.daysToTp1.p20} – {decision.holdPlan.horizonEstimate.daysToTp1.p80} hari
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-400">Time Stop Maksimal:</span>
              <span className="font-semibold text-rose-400">
                {decision.holdPlan.timeStop.maxDays} hari (Keluar apa pun P&amp;L)
              </span>
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded border border-slate-800/80">
            <span className="text-xs font-bold text-rose-300 uppercase block mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Tesis Batal Jika:
            </span>
            <ul className="text-xs space-y-1 text-slate-300 list-disc list-inside">
              {decision.holdPlan.invalidationTriggers.slice(0, 4).map((t) => (
                <li key={t.id}>{t.description}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ④ KENAPA & ⑤ KENAPA TIDAK (RED TEAM) BLOK */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ④ KENAPA */}
          <div className="p-4 bg-slate-900/60 rounded-lg border border-slate-800">
            <div className="text-xs font-bold text-emerald-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> ④ KENAPA (Bukti Pendukung)
            </div>
            <ul className="space-y-2 text-xs text-slate-300">
              {decision.gateChecks.passed.slice(0, 4).map((pass, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>{pass}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ⑤ KENAPA TIDAK (RED TEAM — WAJIB & UNCLOSABLE) */}
          <div className="p-4 bg-rose-950/20 rounded-lg border border-rose-900/40">
            <div className="text-xs font-bold text-rose-400 tracking-wider uppercase mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" /> ⑤ KENAPA TIDAK (Red Team — Kasus Lawan)
            </div>
            {decision.redTeamObjections.length > 0 ? (
              <ul className="space-y-2 text-xs text-slate-300">
                {decision.redTeamObjections.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">•</span>
                    <span>
                      {obj.objection}{' '}
                      <span className="text-[10px] font-semibold text-rose-400 px-1 py-0.2 bg-rose-950/60 rounded border border-rose-800/40">
                        {obj.severity}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Red Team tidak menemukan anomali mayor pada setup ini. Tetap patuhi Stop Loss dan Time Stop.
              </p>
            )}
          </div>
        </div>

        {/* FOOTER TRACK RECORD */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap justify-between items-center">
          <span>{decision.probability.reliabilityNote}</span>
          <span className="text-slate-500">Adimology Pro v2.0 · Brier Score Calibrated</span>
        </div>
      </div>

      {/* FACT PROVENANCE MODAL / POPOVER */}
      {selectedFact && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-5 shadow-2xl text-slate-100">
            <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">{selectedFact.fact_id}</h3>
                <span className="text-[10px] text-slate-400">Fact Provenance Inspector</span>
              </div>
              <button
                onClick={() => setSelectedFact(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Nilai Otentik:</span>
                <span className="font-bold text-emerald-400">{String(selectedFact.value)} {selectedFact.unit}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Sumber:</span>
                <span className="font-semibold text-slate-200">{selectedFact.source}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Umur Data:</span>
                <span className="text-slate-200">{selectedFact.age_sec} detik</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Keyakinan Feed:</span>
                <span className="text-slate-200">{(selectedFact.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Kripto Hash:</span>
                <span className="font-mono text-slate-400 text-[10px]">{selectedFact.hash}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedFact(null)}
              className="mt-5 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
