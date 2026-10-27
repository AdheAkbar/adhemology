import ModelHealthView from '../components/ModelHealthView';

export const metadata = {
  title: 'Model Health & Calibration — SmartMoney AI',
  description: 'Evaluasi kalibrasi probabilitas, Brier score, kurva decile reliability, dan champion vs challenger model comparison.',
};

export default function ModelHealthPage() {
  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Model Health &amp; Calibration
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Transparansi performa model machine learning, audit keandalan kalibrasi, dan perbandingan Champion vs Challenger.
        </p>
      </div>
      <ModelHealthView />
    </div>
  );
}
