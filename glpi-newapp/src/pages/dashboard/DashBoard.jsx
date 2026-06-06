import { useEffect, useState } from 'react';
import { fetchAssetStats, fetchTicketStats } from '../../services/dashboardService';

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

  if (loading) return <p style={{ padding: 24 }}>Chargement...</p>;
  if (error)   return <p style={{ padding: 24, color: 'red' }}>{error}</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>
        Tableau de bord
      </h1>

      {/* ── PARC ── */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 500 }}>Parc informatique</h2>
          <span style={{
            fontSize: 13, padding: '2px 10px', borderRadius: 20,
            background: '#e0f2fe', color: '#0369a1', fontWeight: 500,
          }}>
            {assets.total} éléments au total
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {assets.details.map((item) => (
            <div key={item.key} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 10, padding: '16px 14px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 28, fontWeight: 600, color: '#1d4ed8', marginBottom: 4 }}>
                {item.count}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TICKETS ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 500 }}>Tickets</h2>
          <span style={{
            fontSize: 13, padding: '2px 10px', borderRadius: 20,
            background: '#fef9c3', color: '#854d0e', fontWeight: 500,
          }}>
            {tickets.total} tickets au total
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {tickets.details.map((item) => (
            <div key={item.key} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderRadius: 10, padding: '16px 14px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 28, fontWeight: 600, color: '#d97706', marginBottom: 4 }}>
                {item.count}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}