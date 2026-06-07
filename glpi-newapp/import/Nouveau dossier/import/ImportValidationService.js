/**
 * Service de validation pour les imports GLPI
 */
const ImportValidationService = {
  validateDate: (dateStr, fieldName = 'date', lineNumber = null) => {
    const errors = [];
    if (!dateStr || !dateStr.trim()) {
      errors.push(ImportValidationService.formatError(fieldName, 'ne doit pas être vide', lineNumber));
      return { valid: false, errors };
    }
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(dateStr)) {
      errors.push(ImportValidationService.formatError(fieldName, 'doit être au format JJ/MM/AAAA', lineNumber));
      return { valid: false, errors };
    }
    return { valid: true, errors: [] };
  },

  validateTime: (timeStr, fieldName = 'heure', lineNumber = null) => {
    const errors = [];
    if (!timeStr || !timeStr.trim()) {
      errors.push(ImportValidationService.formatError(fieldName, 'ne doit pas être vide', lineNumber));
      return { valid: false, errors };
    }
    const timeRegex = /^\d{2}:\d{2}$|^\d{2}:\d{2}:\d{2}$/;
    if (!timeRegex.test(timeStr)) {
      errors.push(ImportValidationService.formatError(fieldName, 'doit être au format HH:mm ou HH:mm:ss', lineNumber));
      return { valid: false, errors };
    }
    return { valid: true, errors: [] };
  },

  validateString: (value, fieldName, lineNumber = null) => {
    const errors = [];
    if (!value || !value.trim()) {
      errors.push(ImportValidationService.formatError(fieldName, 'ne doit pas être vide', lineNumber));
      return { valid: false, errors };
    }
    return { valid: true, errors: [] };
  },

  validateNumber: (value, fieldName, options = {}, lineNumber = null) => {
    const errors = [];
    if (value === undefined || value === null || value === '') {
      return { valid: false, errors: [ImportValidationService.formatError(fieldName, 'ne doit pas être vide', lineNumber)] };
    }

    const cleanValue = typeof value === 'string' ? value.replace(',', '.') : value;
    const num = Number(cleanValue);

    if (isNaN(num)) {
      return { valid: false, errors: [ImportValidationService.formatError(fieldName, 'doit être un nombre valide', lineNumber)] };
    }

    if (options.min !== undefined && num < options.min) {
      errors.push(ImportValidationService.formatError(fieldName, `doit être >= ${options.min}`, lineNumber));
    }

    if (options.isInteger && !Number.isInteger(num)) {
      errors.push(ImportValidationService.formatError(fieldName, 'doit être un nombre entier', lineNumber));
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, errors: [], value: num };
  },

  validateCSVHeaders: (headers, expectedHeaders, fileName) => {
    const errors = [];
    const normalizedHeaders = headers.map(h => h.trim());
    
    if (normalizedHeaders.length !== expectedHeaders.length) {
      errors.push(`Nombre de colonnes non conforme dans ${fileName}. Attendu: ${expectedHeaders.length}, Reçu: ${normalizedHeaders.length}`);
    }
    for (let i = 0; i < expectedHeaders.length; i++) {
      if (normalizedHeaders[i] && expectedHeaders[i] && normalizedHeaders[i].toLowerCase() !== expectedHeaders[i].toLowerCase()) {
        errors.push(`En-tête non conforme dans ${fileName} à la colonne ${i+1} : "${normalizedHeaders[i]}" au lieu de "${expectedHeaders[i]}"`);
      }
    }
    
    return { valid: errors.length === 0, errors };
  },

  validateItemRow: (row, lineNumber) => {
    const errors = [];
    const [name, status, location, manufacturer, itemType, model, inventoryNumber, user] = row;
    
    errors.push(...ImportValidationService.validateString(name, 'Name', lineNumber).errors);
    errors.push(...ImportValidationService.validateString(status, 'Status', lineNumber).errors);
    errors.push(...ImportValidationService.validateString(itemType, 'Item_Type', lineNumber).errors);
    
    return { valid: errors.length === 0, errors };
  },

  validateTicketRow: (row, lineNumber) => {
    const errors = [];
    const [refTicket, date, heure, type, titre, description, status, priority, items] = row;
    
    errors.push(...ImportValidationService.validateString(refTicket, 'Ref_Ticket', lineNumber).errors);
    errors.push(...ImportValidationService.validateDate(date, 'Date', lineNumber).errors);
    errors.push(...ImportValidationService.validateTime(heure, 'Heure', lineNumber).errors);
    errors.push(...ImportValidationService.validateString(titre, 'Titre', lineNumber).errors);
    
    return { valid: errors.length === 0, errors };
  },

  validateCostRow: (row, lineNumber) => {
    const errors = [];
    const [numTicket, durationSecond, timeCost, fixedCost] = row;
    
    errors.push(...ImportValidationService.validateString(numTicket, 'Num_Ticket', lineNumber).errors);
    errors.push(...ImportValidationService.validateNumber(durationSecond, 'Duration_second', { min: 0, isInteger: true }, lineNumber).errors);
    errors.push(...ImportValidationService.validateNumber(timeCost, 'Time_Cost', { min: 0 }, lineNumber).errors);
    errors.push(...ImportValidationService.validateNumber(fixedCost, 'Fixed_Cost', { min: 0 }, lineNumber).errors);
    
    return { valid: errors.length === 0, errors };
  },

  validateFile: (file, allowedTypes = [], maxSizeMB = 10) => {
    const errors = [];
    if (!file) {
      errors.push('Le fichier ne doit pas être vide');
      return { valid: false, errors };
    }
    if (file.size === 0) {
      errors.push('Le fichier est vide');
      return { valid: false, errors };
    }
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      errors.push(`Le fichier dépasse la taille maximale (${maxSizeMB}Mo)`);
      return { valid: false, errors };
    }
    if (allowedTypes.length > 0) {
      const fileExt = file.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(fileExt)) {
        errors.push(`Type de fichier invalide. Types autorisés : ${allowedTypes.join(', ')}`);
        return { valid: false, errors };
      }
    }
    return { valid: true, errors: [] };
  },

  formatError: (fieldName, message, lineNumber = null) => {
    if (lineNumber !== null) {
      return `Ligne ${lineNumber} : Le champ "${fieldName}" ${message}`;
    }
    return `Le champ "${fieldName}" ${message}`;
  }
};

export default ImportValidationService;
