import CustomSignalLab from '../components/CustomSignalLab';

export const metadata = {
  title: 'Sinyal & Berita AI Lab — Adimology V6',
  description: 'Validasi sinyal trading, berita emiten, dan rumor aksi korporasi secara objektif terhadap data broker flow riil bursa efek Indonesia.',
};

export default function SignalsPage() {
  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <CustomSignalLab />
    </div>
  );
}
