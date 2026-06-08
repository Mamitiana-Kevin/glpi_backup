import React, { useState } from 'react';
import { runImport } from '../../../services/import/importOrchestrator';

export default function ImportPage() {
  // Style pour le curseur clignotant des logs
  const blinkStyle = `
    @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
    .blink { animation: blink 1s infinite; }
  `;

  const [files, setFiles] = useState({
    feuille1: null,
    feuille2: null,
    feuille3: null,
    zipFile: null,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);

  const handleFileChange = (e, key) => {
    setFiles(prev => ({ ...prev, [key]: e.target.files[0] }));
  };

  const addLog = (message) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const handleImport = async () => {
    if (!files.feuille1 || !files.feuille2 || !files.feuille3) {
      setError("Veuillez sélectionner les 3 fichiers CSV.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setLogs([]);

    try {
      const res = await runImport(files, addLog);
      setResult(res);
      if (!res.success) {
        setError(res.error || "Erreurs de validation détectées.");
      }
    } catch (err) {
      console.error(err);
      setError("Une erreur inattendue est survenue lors de l'import.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <style>{blinkStyle}</style>
      <div className="page-header">
        <h2>Système d'importation</h2>
        <p>Importation séquentielle : Assets → Tickets → Coûts</p>
      </div>

      <div className="glpi-card" style={{ maxWidth: '600px' }}>
        <div className="form-group">
          <label>1. Fichier Assets (Computer, Monitor, etc.)</label>
          <input className="form-control" type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'feuille1')} />
        </div>

        <div className="form-group">
          <label>2. Fichier Tickets (Incidents, Demandes)</label>
          <input className="form-control" type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'feuille2')} />
        </div>

        <div className="form-group">
          <label>3. Fichier Coûts (Interventions)</label>
          <input className="form-control" type="file" accept=".csv" onChange={(e) => handleFileChange(e, 'feuille3')} />
        </div>

        <div className="form-group">
          <label>4. ZIP d'images (Optionnel)</label>
          <input className="form-control" type="file" accept=".zip" onChange={(e) => handleFileChange(e, 'zipFile')} />
        </div>

        <button 
          onClick={handleImport} 
          disabled={loading}
          className={`btn btn-primary ${loading ? 'disabled' : ''}`}
          style={{ width: '100%', marginTop: '10px' }}
        >
          {loading ? "Importation en cours..." : "Lancer l'import complet"}
        </button>
      </div>

      {(logs.length > 0 || loading) && (
        <div style={{ marginTop: '20px', padding: '15px', background: '#2c3e50', color: '#00ff00', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #444' }}>JOURNAL D'IMPORTATION :</div>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
          {loading && <div className="blink">_</div>}
        </div>
      )}

      {error && (
        <div className="badge status-4" style={{ marginTop: '20px', padding: '15px', display: 'block', color: '#900' }}>
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {result && !result.success && result.validationErrors && (
        <div style={{ marginTop: '20px' }}>
          <h3>Erreurs de validation</h3>
          {Object.entries(result.validationErrors).map(([key, errors]) => (
            errors.length > 0 && (
              <div key={key} style={{ marginBottom: '10px' }}>
                <strong>{key === 'feuille1' ? 'Assets' : key === 'feuille2' ? 'Tickets' : 'Coûts'} :</strong>
                <ul>
                  {errors.map((err, i) => (
                    <li key={i}>{JSON.stringify(err)}</li>
                  ))}
                </ul>
              </div>
            )
          ))}
        </div>
      )}

      {result && result.success && (
        <div style={{ marginTop: '20px' }}>
          <h3>Rapport d'importation</h3>
          <div style={{ display: 'flex', gap: '20px' }}>
            <StatCard title="Assets" stats={result.stats.assets} />
            <StatCard title="Tickets" stats={result.stats.tickets} />
            <StatCard title="Coûts" stats={result.stats.costs} />
            {!result.stats.images.skipped && <StatCard title="Images" stats={result.stats.images} />}
          </div>

          <div style={{ marginTop: '20px' }}>
            <h4>Détails des erreurs (si présentes)</h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', padding: '10px' }}>
              {result.details.assets.filter(r => !r.success).map((r, i) => (
                <div key={i} style={{ color: 'red' }}>Asset {r.name}: {r.error}</div>
              ))}
              {result.details.tickets.filter(r => !r.success).map((r, i) => (
                <div key={i} style={{ color: 'red' }}>Ticket {r.ref}: {r.error}</div>
              ))}
              {result.details.costs.filter(r => !r.success).map((r, i) => (
                <div key={i} style={{ color: 'red' }}>Coût Ticket {r.num_ticket}: {r.error}</div>
              ))}
              {result.details.images && result.details.images.filter(r => !r.success).map((r, i) => (
                <div key={i} style={{ color: 'red' }}>Image {r.assetName}: {r.error}</div>
              ))}
              {result.stats.assets.failed === 0 && result.stats.tickets.failed === 0 && result.stats.costs.failed === 0 && (!result.stats.images.total || result.stats.images.failed === 0) && (
                <p style={{ color: 'green' }}>Aucune erreur lors de l'importation des lignes.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, stats }) {
  return (
    <div style={{ padding: '15px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', flex: 1 }}>
      <h4 style={{ margin: '0 0 10px 0' }}>{title}</h4>
      <div style={{ fontSize: '14px' }}>
        <div>Total : {stats.total}</div>
        <div style={{ color: 'green' }}>Succès : {stats.success}</div>
        <div style={{ color: 'red' }}>Échecs : {stats.failed}</div>
      </div>
    </div>
  );
}
