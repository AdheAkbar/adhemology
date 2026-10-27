import LiveScanner from '../components/LiveScanner';

export const metadata = {
  title: 'Live Quant Scanner — SmartMoney AI',
  description: 'Real-time ranking, accumulation-like proxy detection, and calibrated setup probability scanner for IDX stocks.',
};

export default function ScannerPage() {
  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Live Quant Scanner
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Mendeteksi pola aliran dana yang menyerupai akumulasi, menghitung probabilitas terkalibrasi, dan menyaring entry risiko terkecil.
        </p>
      </div>
      <LiveScanner />
    </div>
  );
}
