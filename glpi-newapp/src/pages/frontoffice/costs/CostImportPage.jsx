
import { useState } from 'react';




import { saveCost, cancelLastActiveCost, fetchBaseForMode, saveReopen } from '../../../services/backend/superCostService';

function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  return lines.map(line => {
    const [ticketIdStr, action, valueStr, modeStr] = line.split(',').map(s => s.trim());
    const ticketId = parseInt(ticketIdStr, 10);
    const mode = modeStr ? parseInt(modeStr, 10) : 1;
    return { ticketId, action, valueStr, mode };
  });
}

function parseNumber(valueStr) {
  // Replace commas with dots to handle both decimal separators
  return parseFloat(valueStr.replace(',', '.'));
}

async function handleOpen(ticketId, valueStr, mode) {
  const pct = parseNumber(valueStr);
  if (isNaN(pct)) throw new Error('Invalid percentage');
  const base = await fetchBaseForMode(ticketId, mode);
  const amount = (pct / 100) * base;
  await saveReopen(ticketId, amount, pct, mode);
}

async function handleClose(ticketId, valueStr) {
  const amount = parseNumber(valueStr);
  if (isNaN(amount)) throw new Error('Invalid amount');
  await saveCost(ticketId, amount);
}

async function handleCancel(ticketId) {
  await cancelLastActiveCost(ticketId);
}

async function processLine({ ticketId, action, valueStr, mode }, index) {
  if (isNaN(ticketId)) {
    throw new Error('Invalid ticket ID');
  }

  switch (action) {
    case 'open':
      await handleOpen(ticketId, valueStr, mode);
      break;
    case 'close':
      await handleClose(ticketId, valueStr);
      break;
    case 'cancel':
      await handleCancel(ticketId);
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export default function CostImportPage() {
  const [errors, setErrors] = useState([]);
  const [processed, setProcessed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // State pour la saisie manuelle
  const [manualTicketId, setManualTicketId] = useState('');
  const [manualAction, setManualAction] = useState('close');
  const [manualValue, setManualValue] = useState('');
  const [manualResult, setManualResult] = useState(null);
  const [manualMode,   setManualMode]   = useState(1);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setErrors([]);
    setProcessed(0);
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    const text = await selectedFile.text();
    const lines = parseCSV(text);

    setErrors([]);
    setProcessed(0);
    setLoading(true);

    const newErrors = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        await processLine(lines[i], i);
        setProcessed(i + 1);
      } catch (err) {
        newErrors.push({ line: i + 1, message: err.message });
      }
    }

    setErrors(newErrors);
    setLoading(false);
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualResult(null);
    setLoading(true);

    try {
      const ticketId = parseInt(manualTicketId, 10);
      if (isNaN(ticketId)) throw new Error('ID ticket invalide');
      
      await processLine({ ticketId, action: manualAction, valueStr: manualValue, mode: manualMode }, 0);
      setManualResult({ success: true, message: 'Opération réussie!' });
      
      // Réinitialiser les champs
      setManualTicketId('');
      setManualValue('');
    } catch (err) {
      setManualResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '22px', marginBottom: '24px' }}>Gestion des coûts</h1>
      
      {/* Import CSV */}
      <div style={{ marginBottom: '48px', borderBottom: '2px solid #e5e7eb', paddingBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Import CSV</h2>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          style={{ marginBottom: '12px' }}
          disabled={loading}
        />
        <button
          onClick={handleProcessFile}
          disabled={!selectedFile || loading}
          style={{
            padding: '8px 16px',
            backgroundColor: selectedFile && !loading ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedFile && !loading ? 'pointer' : 'not-allowed',
            marginBottom: '24px'
          }}
        >
          Traiter le fichier
        </button>
        {loading && <p>Traitement en cours... {processed}/{errors.length + processed}</p>}
        {!loading && (processed + errors.length) > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3>Résultat import</h3>
            <p>Lignes traitées: {processed}</p>
            <p>Erreurs: {errors.length}</p>
            {errors.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <h4>Liste des erreurs</h4>
                <ul style={{ paddingLeft: '24px' }}>
                  {errors.map((err, idx) => (
                    <li key={idx}>Ligne {err.line}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saisie manuelle */}
      <div>
        <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Saisie manuelle</h2>
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>ID du ticket</label>
            <input
              type="number"
              value={manualTicketId}
              onChange={(e) => setManualTicketId(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px'
              }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Action</label>
            <select
              value={manualAction}
              onChange={(e) => setManualAction(e.target.value)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="close">Fermer (ajouter super coût)</option>
              <option value="open">Ouvrir (réouverture)</option>
              <option value="cancel">Annuler</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
              {manualAction === 'cancel' ? '(pas de valeur nécessaire)' : 'Valeur (montant ou %)'}
            </label>
            <input
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              disabled={loading || manualAction === 'cancel'}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: manualAction === 'cancel' ? '#f3f4f6' : 'white'
              }}
              required={manualAction !== 'cancel'}
            />
          </div>

          {manualAction === 'open' && (
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Base de calcul (mode)</label>
              <select
                value={manualMode}
                onChange={(e) => setManualMode(parseInt(e.target.value, 10))}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value={1}>1 — Dernier coût</option>
                <option value={2}>2 — Premier coût</option>
                <option value={3}>3 — Total des coûts</option>
                <option value={4}>4 — Moyenne des coûts</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 16px',
              backgroundColor: loading ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {loading ? 'Traitement en cours...' : 'Valider'}
          </button>
        </form>

        {manualResult && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '4px',
              backgroundColor: manualResult.success ? '#d4edda' : '#f8d7da',
              color: manualResult.success ? '#155724' : '#721c24',
              border: `1px solid ${manualResult.success ? '#c3e6cb' : '#f5c6cb'}`
            }}
          >
            {manualResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
