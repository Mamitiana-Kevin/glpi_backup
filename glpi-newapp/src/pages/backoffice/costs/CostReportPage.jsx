
import { useState, useEffect } from 'react';
import { Legacy } from '../../../api/glpiClient';
import { fetchCostReport } from '../../../services/backend/superCostService';
import { fetchGlpiCostByItemtype } from '../../../services/ticketService';

async function fetchItemName(item) {
  const itemtypeMap = {
    Computer: 'Computer',
    Monitor: 'Monitor',
    Phone: 'Phone',
    Printer: 'Printer',
    Peripheral: 'Peripheral',
    NetworkEquipment: 'NetworkEquipment',
    Software: 'Software'
  };

  const glpiType = itemtypeMap[item.itemtype] || item.itemtype;

  try {
    const res = await Legacy.get(`/${glpiType}/${item.item_id}`);
    return res.data.name || `ID ${item.item_id}`;
  } catch {
    return `ID ${item.item_id}`;
  }
}

export default function CostReportPage() {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedType, setExpandedType] = useState(null);
  const [itemNames, setItemNames] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const superCostReport = await fetchCostReport();
      // Now fetch GLPI costs
      const tickets = await Legacy.get('/Ticket', { is_deleted: 0 });
      const ticketList = Array.isArray(tickets.data) ? tickets.data : [];
      const glpiCosts = {};

      for (const ticket of ticketList) {
        try {
          const ticketCosts = await fetchGlpiCostByItemtype(ticket.id);
          for (const [itemtype, cost] of Object.entries(ticketCosts)) {
            if (!glpiCosts[itemtype]) {
              glpiCosts[itemtype] = 0;
            }
            glpiCosts[itemtype] += cost;
          }
        } catch (e) {
          console.error('Error processing ticket', ticket.id, e);
        }
      }

      // Merge data
      const mergedData = superCostReport.map(row => ({
        ...row,
        total_glpi_cost: glpiCosts[row.itemtype] || 0
      }));

      // Add item types that have GLPI costs but no super costs
      for (const [itemtype, cost] of Object.entries(glpiCosts)) {
        if (!mergedData.find(r => r.itemtype === itemtype)) {
          mergedData.push({
            itemtype,
            total_super_cost: 0,
            total_reopening_cost: 0,
            total_glpi_cost: cost,
            items: []
          });
        }
      }

      setReportData(mergedData);
    } catch (e) {
      console.error('Erreur chargement données', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (itemtype) => {
    if (expandedType === itemtype) {
      setExpandedType(null);
      return;
    }
    setExpandedType(itemtype);
    // Load names for items of this type
    const typeData = reportData.find(r => r.itemtype === itemtype);
    if (typeData && typeData.items) {
      for (const item of typeData.items) {
        const key = `${item.itemtype}-${item.item_id}`;
        if (!itemNames[key]) {
          const name = await fetchItemName(item);
          setItemNames(prev => ({ ...prev, [key]: name }));
        }
      }
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
            <th style={{ padding: 12, border: '1px solid #e5e7eb', textAlign: 'left' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {reportData.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 12, border: '1px solid #e5e7eb', textAlign: 'center' }}>
                Aucune donnée à afficher
              </td>
            </tr>
          )}
          {reportData.map((row, index) => (
            <>
              <tr key={index} onClick={() => handleToggle(row.itemtype)} style={{ cursor: 'pointer' }}>
                <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{row.itemtype}</td>
                <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{(row.total_glpi_cost || 0).toFixed(3)} €</td>
                <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{(row.total_super_cost || 0).toFixed(3)} €</td>
                <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{(row.total_reopening_cost || 0).toFixed(3)} €</td>
                <td style={{ padding: 12, border: '1px solid #e5e7eb' }}>{(row.total_super_cost + row.total_reopening_cost + row.total_glpi_cost || 0).toFixed(3)} €</td>
              </tr>
              {expandedType === row.itemtype && row.items && row.items.length > 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <div style={{ padding: 12, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                        <thead>
                          <tr style={{ background: '#e5e7eb' }}>
                            <th style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'left' }}>ID</th>
                            <th style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'left' }}>Nom</th>
                            <th style={{ padding: 8, border: '1px solid #e5e7eb', textAlign: 'left' }}>Coût réparti</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.items.map((item, idx) => {
                            const key = `${item.itemtype}-${item.item_id}`;
                            const name = itemNames[key] || `Chargement...`;
                            return (
                              <tr key={idx}>
                                <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{item.item_id}</td>
                                <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{name}</td>
                                <td style={{ padding: 8, border: '1px solid #e5e7eb' }}>{(item.allocatedCost || 0).toFixed(2)} €</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
