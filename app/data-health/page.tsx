import DataHealthView from '../components/DataHealthView';

export const metadata = {
  title: 'Data Health & Provenance — SmartMoney AI',
  description: 'Pemantauan integritas 14 kapabilitas data pasar, latensi feed, dan penegakan kepatuhan regulasi closed-session BEI.',
};

export default function DataHealthPage() {
  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Data Health &amp; Provenance
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Melacak kapabilitas sumber data pasar, masa berlaku token sesi, dan mencegah imputasi data diam-diam.
        </p>
      </div>
      <DataHealthView />
    </div>
  );
}
