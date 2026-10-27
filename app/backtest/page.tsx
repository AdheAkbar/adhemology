import BacktestLabView from '../components/BacktestLabView';

export const metadata = {
  title: 'Quantitative Backtest Lab — SmartMoney AI',
  description: 'Simulasi strategi day trading dan swing trading pada data historis BEI dengan pemodelan slippage dan komisi transaksi.',
};

export default function BacktestPage() {
  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          Quantitative Backtest Lab
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Validasi strategi kuantitatif out-of-sample dengan memperhitungkan biaya transaksi, pajak 0.1%, dan slippage pasar nyata.
        </p>
      </div>
      <BacktestLabView />
    </div>
  );
}
