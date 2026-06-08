/**
 * Colonnes exactes attendues (ordre strict, 9 colonnes) :
 * Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items
 */
export function validateTicketCSV(text) {
  const errors = [];
  if (!text || !text.trim()) {
    return { valid: false, errors: [{ type: 'NO_DATA_ROWS' }] };
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length === 0) {
    return { valid: false, errors: [{ type: 'NO_DATA_ROWS' }] };
  }

  const expectedColumns = ["Ref_Ticket", "Date", "Heure", "Type", "Titre", "Description", "Status", "Priority", "Items"];
  const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));

  if (header.length !== expectedColumns.length) {
    return { 
      valid: false, 
      errors: [{ type: 'WRONG_COLUMN_COUNT', expected: expectedColumns.length, found: header.length }] 
    };
  }

  for (let i = 0; i < expectedColumns.length; i++) {
    if (header[i] !== expectedColumns[i]) {
      errors.push({ type: 'WRONG_COLUMN_NAME', index: i, expected: expectedColumns[i], found: header[i] });
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  if (lines.length === 1) {
    return { valid: false, errors: [{ type: 'NO_DATA_ROWS' }] };
  }

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const rowData = {};
    header.forEach((h, idx) => rowData[h] = values[idx]);

    if (!rowData.Ref_Ticket) errors.push({ type: 'MISSING_REQUIRED_VALUE', row: i, column: 'Ref_Ticket' });
    if (!rowData.Titre) errors.push({ type: 'MISSING_REQUIRED_VALUE', row: i, column: 'Titre' });
    if (!rowData.Type) errors.push({ type: 'MISSING_REQUIRED_VALUE', row: i, column: 'Type' });
    if (!rowData.Status) errors.push({ type: 'MISSING_REQUIRED_VALUE', row: i, column: 'Status' });
    if (!rowData.Priority) errors.push({ type: 'MISSING_REQUIRED_VALUE', row: i, column: 'Priority' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
