
import { useState, useEffect } from 'react';
import {
  fetchAllReopens, updateReopen,
  fetchAllCloseCosts, updateCloseCost,
} from '../../../services/backend/superCostService';

const MODE_LABELS = { 1: 'Dernier', 2: 'Premier', 3: 'Moyenne', 4: 'Total' };

function useInlineEdit() {
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  return { editId, editData, setEditId, setEditData };
}

export default function ReopenListPage() {
  const [closes, setCloses] = useState([]);
  const [reopens, setReopens] = useState([]);

  const closeEdit = useInlineEdit();
  const reopenEdit = useInlineEdit();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [c, r] = await Promise.all([fetchAllCloseCosts(), fetchAllReopens()]);
      setCloses(Array.isArray(c) ? c : []);
      setReopens(Array.isArray(r) ? r : []);
    } catch (err) {
      console.error("Failed to load SQLite data:", err);
      setCloses([]);
      setReopens([]);
    }
  }

  // ── Close ──────────────────────────────────────────────────
  async function saveClose() {
    try {
      await updateCloseCost(closeEdit.editId, parseFloat(closeEdit.editData.amount));
      closeEdit.setEditId(null);
      loadAll();
    } catch (err) {
      console.error("Error saving close cost:", err);
    }
  }

  // ── Reopen ─────────────────────────────────────────────────
  async function saveReopen() {
    try {
      await updateReopen(
        reopenEdit.editId,
        parseFloat(reopenEdit.editData.pct),
        parseInt(reopenEdit.editData.mode, 10)
      );
      reopenEdit.setEditId(null);
      loadAll();
    } catch (err) {
      console.error("Error saving reopen:", err);
    }
  }

  const safeCloses = closes || [];
  const safeReopens = reopens || [];

  return (
    <div>
      <h1>Données SQLite</h1>

      {/* ── Section Supercosts (close) ── */}
      <h2>Supercosts (fermeture)</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Ticket</th><th>Montant</th><th>Actif</th><th>Date</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {safeCloses.length === 0 && <tr><td colSpan={6}>Aucun supercost</td></tr>}
          {safeCloses.map(row => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.ticket_id}</td>
              <td>
                {closeEdit.editId === row.id
                  ? <input type="number" value={closeEdit.editData.amount}
                      onChange={e => closeEdit.setEditData({ amount: e.target.value })} />
                  : `${Number(row.amount).toFixed(2)} €`}
              </td>
              <td>{row.is_active ? 'Oui' : 'Non'}</td>
              <td>{row.created_at}</td>
              <td>
                {closeEdit.editId === row.id ? (
                  <>
                    <button onClick={saveClose}>Enregistrer</button>
                    <button onClick={() => closeEdit.setEditId(null)}>Annuler</button>
                  </>
                ) : (
                  <button onClick={() => { closeEdit.setEditId(row.id); closeEdit.setEditData({ amount: row.amount }); }}>
                    Modifier
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Section Réouvertures (reopen) ── */}
      <h2>Réouvertures</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Ticket</th><th>Montant</th><th>Pourcentage</th><th>Mode</th><th>Date</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {safeReopens.length === 0 && <tr><td colSpan={7}>Aucune réouverture</td></tr>}
          {safeReopens.map(row => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.ticket_id}</td>
              <td>{Number(row.amount).toFixed(2)} €</td>
              <td>
                {reopenEdit.editId === row.id
                  ? <input type="number" value={reopenEdit.editData.pct}
                      onChange={e => reopenEdit.setEditData(d => ({ ...d, pct: e.target.value }))} />
                  : `${row.reopening_pct} %`}
              </td>
              <td>
                {reopenEdit.editId === row.id
                  ? (
                    <select value={reopenEdit.editData.mode}
                      onChange={e => reopenEdit.setEditData(d => ({ ...d, mode: e.target.value }))}>
                      <option value={1}>1 — Dernier</option>
                      <option value={2}>2 — Premier</option>
                      <option value={3}>3 — Moyenne</option>
                      <option value={4}>4 — Total</option>
                    </select>
                  )
                  : `${row.reopen_mode} — ${MODE_LABELS[row.reopen_mode] ?? '?'}`}
              </td>
              <td>{row.created_at}</td>
              <td>
                {reopenEdit.editId === row.id ? (
                  <>
                    <button onClick={saveReopen}>Enregistrer</button>
                    <button onClick={() => reopenEdit.setEditId(null)}>Annuler</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { reopenEdit.setEditId(row.id); reopenEdit.setEditData({ pct: row.reopening_pct, mode: row.reopen_mode }); }}>
                      Modifier
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

