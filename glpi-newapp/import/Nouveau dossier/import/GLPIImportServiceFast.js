import api from '../../config/api';
import ComputerService from '../Computer/ComputerService';
import TicketService from '../Ticket/TicketService';
import TicketCostService from '../TicketCost/TicketCostService';
import TicketTaskService from '../TicketTask/TicketTaskService';
import ItemTicketService from '../ItemTicket/ItemTicketService';
import GLPIImportHelpers from './GLPIImportHelpers';
import ImportValidationService from './ImportValidationService';

const GLPIImportServiceFast = {
  ...GLPIImportHelpers,

  /**
   * Importe une ligne de la Feuille 1 (Items / Équipements)
   * Headers: Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User
   */
  importItemRow: async (row, onProgress = null) => {
    const [name, status, location, manufacturer, itemType, model, inventoryNumber, user] = row;
    
    // 1. Résoudre les relations
    const states_id = await GLPIImportServiceFast.resolveState(status);
    const locations_id = await GLPIImportServiceFast.resolveLocation(location);
    const manufacturers_id = await GLPIImportServiceFast.resolveManufacturer(manufacturer);
    const computermodels_id = await GLPIImportServiceFast.resolveComputerModel(model);
    const users_id = await GLPIImportServiceFast.resolveUser(user);
    
    // 2. Créer l'équipement en fonction de son type
    // On s'assure que le type correspond à la bonne entité GLPI (Computer, Monitor, Printer...)
    const validItemType = (itemType && itemType.trim()) ? itemType.trim() : 'Computer';

    const itemData = {
      name: name,
      otherserial: inventoryNumber,
      states_id: states_id || 0,
      locations_id: locations_id || 0,
      manufacturers_id: manufacturers_id || 0,
      // Note : les modèles sont gérés différemment selon le type d'équipement dans GLPI (ex: computermodels_id vs monitormodels_id)
      // Pour simplifier, on envoie la donnée de modèle avec la clé dynamique si ce n'est pas un Computer
      [`${validItemType.toLowerCase()}models_id`]: computermodels_id || 0,
      users_id: users_id || 0
    };
    
    try {
      const response = await api.post(`/${validItemType}`, { input: itemData });
      if (onProgress) onProgress(validItemType.toLowerCase(), response.data.id);
      return { success: true, id: response.data.id, name: name };
    } catch (error) {
      console.error(`Erreur lors de l'import de l'équipement ${name} (${validItemType}):`, error);
      throw error;
    }
  },

  /**
   * Importe une ligne de la Feuille 2 (Tickets)
   * Headers: Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items
   */
  importTicketRow: async (row, onProgress = null) => {
    const [refTicket, date, heure, type, titre, description, status, priority, itemsStr] = row;
    
    // Formatage de la date (JJ/MM/AAAA vers AAAA-MM-JJ HH:mm:ss)
    const dateParts = date.split('/');
    let formattedDate = null;
    if (dateParts.length === 3) {
      const heureVal = heure && heure.trim() ? heure : '00:00:00';
      const timeParts = heureVal.split(':');
      const formattedTime = timeParts.length === 2 ? `${heureVal}:00` : heureVal;
      formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]} ${formattedTime}`;
    }

    // Mapping statique basique pour Status, Priority, Type
    const statusMap = {
      'New': 1,
      'Assign': 2,
      'Planned': 3,
      'Pending': 4,
      'Solved': 5,
      'Closed': 6
    };
    
    const priorityMap = {
      'Very Low': 1,
      'Low': 2,
      'Medium': 3,
      'High': 4,
      'Very High': 5,
      'Major': 6
    };

    const typeMap = {
      'Incident': 1,
      'Request': 2
    };

    const ticketData = {
      name: titre,
      content: description,
      date: formattedDate,
      status: statusMap[status] || 1,
      priority: priorityMap[priority] || 3,
      type: typeMap[type] || 1
    };

    try {
      // 1. Créer le ticket
      const ticketResponse = await TicketService.createTicket(ticketData);
      const newTicketId = ticketResponse.id;
      if (onProgress) onProgress('ticket', newTicketId);

      // 2. Lier les équipements (itemsStr)
      if (itemsStr && itemsStr.trim()) {
        try {
          // Exemple CSV: "[""PC-ADM-001"",""MN-FORM-002""]" (les guillemets extérieurs ont été enlevés par le parseur, il reste [""PC-ADM-001"",""MN-FORM-002""])
          let cleanStr = itemsStr.trim();
          
          // Enlever les guillemets superflus aux extrémités s'ils ont été ajoutés par le CSV (ex: "[""PC""]" devient ["PC"])
          if (cleanStr.startsWith('"') && cleanStr.endsWith('"')) {
            cleanStr = cleanStr.substring(1, cleanStr.length - 1);
          }
          
          // Si la chaîne commence par '[' et finit par ']', on essaie de la nettoyer
          if (cleanStr.startsWith('[') && cleanStr.endsWith(']')) {
             // 1. On enlève les doubles guillemets collés (ex: ""PC-ADM-001"" -> "PC-ADM-001")
             cleanStr = cleanStr.replace(/""/g, '"');
             
             // 2. Si par hasard on se retrouve avec des valeurs sans guillemets comme [PC-ADM-001, MN-FORM-002]
             // on va extraire le contenu et le reconstruire
             const content = cleanStr.substring(1, cleanStr.length - 1).trim();
             if (content) {
                // On divise par les virgules et on force l'ajout des guillemets
                const itemsList = content.split(',').map(item => {
                   let i = item.trim();
                   // on enlève d'éventuels guillemets résiduels
                   i = i.replace(/^"/, '').replace(/"$/, '');
                   return `"${i}"`;
                });
                cleanStr = `[${itemsList.join(',')}]`;
             }
          } else {
             // S'il n'y a pas de crochets, on traite ça comme une simple chaîne (ex: un seul PC)
             cleanStr = `["${cleanStr.replace(/"/g, '')}"]`;
          }

          const itemsArray = JSON.parse(cleanStr);
          
          for (const itemRef of itemsArray) {
            // Chercher l'équipement par son nom
            const itemData = await GLPIImportServiceFast.resolveItem(itemRef);
            if (itemData) {
              await ItemTicketService.linkItemToTicket(newTicketId, itemData.id, itemData.type);
            } else {
              console.warn(`Équipement non trouvé pour liaison au ticket: ${itemRef}`);
            }
          }
        } catch (e) {
          console.warn(`Erreur lors du parsing des items pour le ticket ${titre}:`, itemsStr, e.message);
        }
      }
      
      return { success: true, id: newTicketId, refTicket: refTicket };
    } catch (error) {
      console.error(`Erreur lors de l'import du ticket ${refTicket}:`, error);
      throw error;
    }
  },

  /**
   * Importe une ligne de la Feuille 3 (Costs)
   * Headers: Num_Ticket, Duration_second, Time_Cost, Fixed_Cost
   */
  importCostRow: async (row, ticketMap, onProgress = null) => {
    const [numTicket, durationSecond, timeCost, fixedCost] = row;
    
    // On doit retrouver le vrai ID du ticket à partir du Num_Ticket (Ref_Ticket)
    // ticketMap est un objet associant Ref_Ticket (fichier 2) à l'ID réel créé dans GLPI.
    const realTicketId = ticketMap[numTicket];
    
    if (!realTicketId) {
      throw new Error(`Ticket correspondant introuvable pour Num_Ticket: ${numTicket}`);
    }

    const costData = {
      name: "Coût importé",
      actiontime: parseInt(durationSecond) || 0,
      cost_time: parseFloat(typeof timeCost === 'string' ? timeCost.replace(',', '.') : timeCost) || 0,
      cost_fixed: parseFloat(typeof fixedCost === 'string' ? fixedCost.replace(',', '.') : fixedCost) || 0
    };

    try {
      const response = await TicketCostService.addCostToTicket(realTicketId, costData);
      if (onProgress) onProgress('cost', response.id);
      return { success: true, id: response.id };
    } catch (error) {
      console.error(`Erreur lors de l'import du coût pour le ticket ${numTicket}:`, error);
      throw error;
    }
  },

  /**
   * Validation des fichiers
   */
  validateItemFile: (data) => {
    const errors = [];
    const expectedHeaders = ['Name', 'Status', 'Location', 'Manufacturer', 'Item_Type', 'Model', 'Inventory_Number', 'User'];
    
    const headersValidation = ImportValidationService.validateCSVHeaders(data.headers, expectedHeaders, 'Fichier Équipements');
    errors.push(...headersValidation.errors);
    
    for (let i = 0; i < data.rows.length; i++) {
      const rowValidation = ImportValidationService.validateItemRow(data.rows[i], i + 2);
      errors.push(...rowValidation.errors);
    }
    
    return { valid: errors.length === 0, errors };
  },

  validateTicketFile: (data) => {
    const errors = [];
    const expectedHeaders = ['Ref_Ticket', 'Date', 'Heure', 'Type', 'Titre', 'Description', 'Status', 'Priority', 'Items'];
    
    const headersValidation = ImportValidationService.validateCSVHeaders(data.headers, expectedHeaders, 'Fichier Tickets');
    errors.push(...headersValidation.errors);
    
    for (let i = 0; i < data.rows.length; i++) {
      const rowValidation = ImportValidationService.validateTicketRow(data.rows[i], i + 2);
      errors.push(...rowValidation.errors);
    }
    
    return { valid: errors.length === 0, errors };
  },

  validateCostFile: (data) => {
    const errors = [];
    const expectedHeaders = ['Num_Ticket', 'Duration_second', 'Time_Cost', 'Fixed_Cost'];
    
    const headersValidation = ImportValidationService.validateCSVHeaders(data.headers, expectedHeaders, 'Fichier Coûts');
    errors.push(...headersValidation.errors);
    
    for (let i = 0; i < data.rows.length; i++) {
      const rowValidation = ImportValidationService.validateCostRow(data.rows[i], i + 2);
      errors.push(...rowValidation.errors);
    }
    
    return { valid: errors.length === 0, errors };
  }
};

export default GLPIImportServiceFast;