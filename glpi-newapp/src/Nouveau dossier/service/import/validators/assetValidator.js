/**
 * Colonnes exactes attendues (ordre strict, 8 colonnes) :
 * Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User
 */
export function validateAssetCSV(text) {
  const errors = [];
  if (!text || !text.trim()) {
    return { valid: false, errors: [{ type: 'NO_DATA_ROWS' }] };
  }

  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length === 0) {
    return { valid: false, errors: [{ type: 'NO_DATA_ROWS' }] };
  }

  const expectedColumns = ["Name", "Status", "Location", "Manufacturer", "Item_Type", "Model", "Inventory_Number", "User"];
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

  // Si erreurs de colonnes, on s'arrête là
  if (errors.length > 0) return { valid: false, errors };

  if (lines.length === 1) {
    return { valid: false, errors: [{ type: 'NO_DATA_ROWS' }] };
  }

  // Validation des lignes
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    // On suppose que le CSV est simple ici pour la validation rapide, 
    // mais parseCSV gérera les virgules dans les guillemets plus tard.
    // Pour la validation de structure simple :
    const rowData = {};
    header.forEach((h, idx) => rowData[h] = values[idx]);

    if (!rowData.Name) {
      errors.push({ type: 'MISSING_REQUIRED_VALUE', row: i, column: 'Name' });
    }
    if (!rowData.Item_Type) {
      errors.push({ type: 'MISSING_REQUIRED_VALUE', row: i, column: 'Item_Type' });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
