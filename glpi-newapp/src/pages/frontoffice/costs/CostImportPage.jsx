
import { useState } from 'react';




import { fetchLastActiveCost, deactivateCost, saveCost, cancelLastActiveCost } from '../../../services/backend/superCostService';

function parseCSV(content) {
  const lines = content.trim().split(/\r?\n/);
  return lines.map(line => {
    const [ticketIdStr, action, valueStr] = line.split(',').map(s => s.trim());
    const ticketId = parseInt(ticketIdStr, 10);
    return { ticketId, action, valueStr };
  });
}

function parseNumber(valueStr) {
  // Replace commas with dots to handle both decimal separators
  return parseFloat(valueStr.replace(',', '.'));
}

async function handleOpen(ticketId, valueStr) {
  const pct = parseNumber(valueStr);
  if (isNaN(pct)) throw new Error('Invalid percentage');
  await deactivateCost(ticketId, pct);
}

async function handleClose(ticketId, valueStr) {
  const amount = parseNumber(valueStr);
  if (isNaN(amount)) throw new Error('Invalid amount');
  const lastActive = await fetchLastActiveCost(ticketId);
  const reopeningPct = lastActive?.reopening_pct ?? null;
  await saveCost(ticketId, amount, reopeningPct);
}

async function handleCancel(ticketId) {
  await cancelLastActiveCost(ticketId);
}

async function processLine({ ticketId, action, valueStr }, index) {
  if (isNaN(ticketId)) {
    throw new Error('Invalid ticket ID');
  }

  switch (action) {
    case 'open':
      await handleOpen(ticketId, valueStr);
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

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '22px', marginBottom: '24px' }}>Import Coûts CSV</h1>
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
          <h2>Résultat</h2>
          <p>Lignes traitées: {processed}</p>
          <p>Erreurs: {errors.length}</p>
          {errors.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <h3>Liste des erreurs</h3>
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
  );
}
