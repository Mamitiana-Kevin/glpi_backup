
import { useState, useEffect } from 'react';
import { Legacy } from '../../../api/glpiClient';
import { fetchCostReport } from '../../../services/backend/superCostService';
import { fetchGlpiCostByItemtype } from '../../../services/ticketService';

export default function CostReportPage() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const superCostReport = await fetchCostReport();
      
      // Convert superCostReport to a map for easy lookup
      const superCostMap = {};
      superCostReport.forEach(row => {
        superCostMap[row.itemtype] = {
          total_super_cost: row.total_effective_cost || 0,
          total_reopening_cost: row.total_reopening_cost || 0
        };
      });
      
      // Fetch GLPI ticket costs using existing function
      const glpiCostsByType = {};
      try {
        const tickets = await Legacy.get('/Ticket', { is_deleted: 0 });
        const ticketList = Array.isArray(tickets.data) ? tickets.data : [];
        
        for (const ticket of ticketList) {
          try {
            const ticketCosts = await fetchGlpiCostByItemtype(ticket.id);
            // Add to total
            for (const [itemtype, cost] of Object.entries(ticketCosts)) {
              if (!glpiCostsByType[itemtype]) {
                glpiCostsByType[itemtype] = 0;
              }
              glpiCostsByType[itemtype] += cost;
            }
          } catch (e) {
            console.error('Error processing ticket', ticket.id, e);
          }
        }
      } catch (e) {
        console.error('Error fetching GLPI data', e);
      }
      
      // Get all unique item types from both GLPI and super costs
      const allItemTypes = new Set([
        ...Object.keys(glpiCostsByType),
        ...Object.keys(superCostMap)
      ]);
      
      // Merge data
      const mergedReport = Array.from(allItemTypes).map(itemtype => ({
        itemtype,
        total_glpi_cost: glpiCostsByType[itemtype] || 0,
        total_super_cost: superCostMap[itemtype]?.total_super_cost || 0,
        total_reopening_cost: superCostMap[itemtype]?.total_reopening_cost || 0
      }));
      
      setReportData(mergedReport);
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

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb' }}>
        <thead style={{ background: '#f9fafb' }}>
          <tr>
            <th style={{ padding: 12, border: '1px solid #e5e7eb', textAlign: 'left' }}>Element</th>
            <th style={{ padding: 12, border: '1px solid #e5e7eb', textAlign: 'left' }}>Total coût GLPI</th>
            <th style={{ padding: 12, border: '1px solid #e5e7eb', textAlign: 'left' }}>Super Coût</th>
            <th style={{ padding: 12, border: '1px solid #e5e7eb', textAlign: 'left' }}>Total coût réouverture</th>
          </tr>
        </thead>
        <tbody>
          {reportData.length === 0 ? (
            <tr>
              <td style={{ padding: 12, border: '1px solid #e5e7eb', textAlign: 'center' }} colSpan={4}>
                Aucune donnée à afficher
              </td>
            </tr>
          ) : (
            reportData.map((row, index) => (
              <tr key={index}>
                <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{row.itemtype}</td>
                <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{row.total_glpi_cost.toFixed(2)} €</td>
                <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{row.total_super_cost.toFixed(2)} €</td>
                <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{row.total_reopening_cost.toFixed(2)} €</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

