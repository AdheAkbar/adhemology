import SignalJournalView from '../components/SignalJournalView';

export const metadata = {
  title: 'AI Signal Journal & Learning Lab — SmartMoney AI',
  description: 'Audit log eksekusi sinyal trading, MFE/MAE tracking, evaluasi kesalahan berbasis taxonomi 14 akar masalah, dan tata kelola model.',
};

export default function JournalPage() {
  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          AI Signal Journal &amp; Learning Lab
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Mencatat seluruh rekam jejak sinyal, menganalisis kesalahan secara otomatis, dan memastikan model hanya di-update berdasarkan bukti statistik empiris.
        </p>
      </div>
      <SignalJournalView />
    </div>
  );
}
