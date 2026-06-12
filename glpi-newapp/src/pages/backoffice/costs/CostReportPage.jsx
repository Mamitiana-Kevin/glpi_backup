import { useState, useEffect } from 'react';
import { Legacy } from '../../../api/glpiClient';
import { getTotalSuperCost } from '../../../services/backend/ticketSuperCostService';

const ITEM_TYPES = ['Computer', 'Monitor', 'Phone'];

export default function CostReportPage() {
  const [selectedType, setSelectedType] = useState('Computer');
  const [totalTicketCost, setTotalTicketCost] = useState(0);
  const [totalSuperCost, setTotalSuperCost] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tickets, superCost] = await Promise.all([
        Legacy.get('/Ticket', { is_deleted: 0 }),
        getTotalSuperCost(),
      ]);

      const ticketList = Array.isArray(tickets.data) ? tickets.data : [];
      
      let total = 0;

      for (const ticket of ticketList) {
        try {
          const itemTickets = await Legacy.get(`/Ticket/${ticket.id}/Item_Ticket`);
          const items = Array.isArray(itemTickets.data) ? itemTickets.data : [];
          
          const filteredItems = items.filter(item => item.itemtype === selectedType);
          
          if (filteredItems.length > 0) {
            const costResponse = await fetch(`/ticket-super-cost/${ticket.id}`);
            if (costResponse.ok) {
              const costData = await costResponse.json();
              if (costData.superCost) {
                const costPerItem = costData.superCost / items.length;
                total += costPerItem * filteredItems.length;
              }
            }
          }
        } catch (e) {
          console.error('Erreur ticket', ticket.id, e);
        }
      }

      setTotalTicketCost(total);
      setTotalSuperCost(superCost || 0);
    } catch (e) {
      console.error('Erreur chargement données', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Chargement...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>Rapport des coûts</h1>

      <div style={{ marginBottom: 24 }}>
        <label style={{ marginRight: 12, fontSize: 14 }}>Type d'élément :</label>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          style={{
            padding: '8px 12px', border: '1px solid #d1d5db',
            borderRadius: 6, fontSize: 14
          }}
        >
          {ITEM_TYPES.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb' }}>
        <thead style={{ background: '#f9fafb' }}>
          <tr>
            <th style={{ padding: 12, border: '1px solid #e5e7eb', textAlign: 'left' }}>Total coûts tickets</th>
            <th style={{ padding: 12, border: '1px solid #e5e7eb', textAlign: 'left' }}>Total super coûts</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{totalTicketCost.toFixed(2)} €</td>
            <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{totalSuperCost.toFixed(2)} €</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
