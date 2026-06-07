import { useEffect, useState } from 'react';
import { fetchAssetStats, fetchTicketStats } from '../../../services/dashboardService';

export default function Dashboard() {
  const [assets, setAssets] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [assetData, ticketData] = await Promise.all([
          fetchAssetStats(),
          fetchTicketStats(),
        ]);
        setAssets(assetData);
        setTickets(ticketData);
      } catch (err) {
        setError('Impossible de charger les données.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="loading">Chargement du tableau de bord...</div>;
  if (error) return <div className="empty-state" style={{ color: 'red' }}>{error}</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Tableau de bord</h2>
        <p>Statistiques globales du parc et de l'assistance</p>
      </div>

      {/* ── PARC ── */}
      <section>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Parc informatique</span>
          <span className="badge status-2">{assets.total} éléments</span>
        </div>

        <div className="stats-grid">
          {assets.details.map((item) => (
            <div key={item.key} className="glpi-card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)', margin: '0 0 8px 0' }}>
                {item.count}
              </p>
              <p className="info-label" style={{ margin: 0 }}>{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TICKETS ── */}
      <section>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Assistance (Tickets)</span>
          <span className="badge status-4">{tickets.total} tickets</span>
        </div>

        <div className="stats-grid">
          {tickets.details.map((item) => (
            <div key={item.key} className="glpi-card" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: '#d97706', margin: '0 0 8px 0' }}>
                {item.count}
              </p>
              <p className="info-label" style={{ margin: 0 }}>{item.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}