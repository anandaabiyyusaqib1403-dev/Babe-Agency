export default function DashboardLoading() {
  return <div className="dashboard-page dashboard-v2 dashboard-loading" aria-label="Memuat dashboard" aria-busy="true">
    <p className="dashboard-inline-empty">Memuat ringkasan workspace…</p>
    <div className="dashboard-kpis dashboard-v2-kpis" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <div className="dashboard-kpi dashboard-loading-block" key={index} />)}</div>
    <div className="dashboard-primary-grid dashboard-v2-grid" aria-hidden="true"><div className="dashboard-panel dashboard-loading-block" /><div className="dashboard-panel dashboard-loading-block" /></div>
  </div>;
}
