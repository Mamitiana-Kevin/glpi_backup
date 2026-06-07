import LocationService from '../Location/LocationService';
import ManufacturerService from '../Manufacturer/ManufacturerService';
import StateService from '../State/StateService';
import UserService from '../User/UserService';
import ComputerModelService from '../ComputerModel/ComputerModelService';
import ComputerService from '../Computer/ComputerService';

/**
 * Service pour aider à l'import en résolvant ou en créant les entités liées.
 */
const GLPIImportHelpers = {
  
  findOrCreateEntity: async (service, entityName, nameField = 'name') => {
    if (!entityName || !entityName.trim()) return null;
    
    // 1. Essayer de trouver
    try {
      // NOTE: L'API GLPI standard permet la recherche via searchText.
      // Si la méthode getAll supporte searchText, on peut l'utiliser,
      // sinon on récupère tout et on filtre en JS (attention si beaucoup d'entrées).
      // Pour être sûr, on utilise une approche simple : on suppose que getAll récupère les éléments,
      // ou on implémente une recherche spécifique si nécessaire.
      
      const items = await service[`getAll${service.name.replace('Service', 's')}`]();
      const existing = items.find(item => item[nameField] && item[nameField].toLowerCase() === entityName.toLowerCase());
      
      if (existing) {
        return existing.id;
      }
    } catch (e) {
      console.warn(`Erreur lors de la recherche de ${entityName}`, e);
    }
    
    // 2. Si non trouvé, on crée
    try {
      const data = {};
      data[nameField] = entityName;
      // Parfois pour user, c'est 'name' ou 'realname'. On va supposer 'name' par défaut.
      
      const response = await service[`create${service.name.replace('Service', '')}`](data);
      return response.id;
    } catch (e) {
      console.error(`Erreur lors de la création de ${entityName}`, e);
      return null;
    }
  },

  resolveLocation: async (locationName) => {
    return await GLPIImportHelpers.findOrCreateEntity(LocationService, locationName);
  },

  resolveManufacturer: async (manufacturerName) => {
    return await GLPIImportHelpers.findOrCreateEntity(ManufacturerService, manufacturerName);
  },

  resolveState: async (stateName) => {
    return await GLPIImportHelpers.findOrCreateEntity(StateService, stateName);
  },

  resolveComputerModel: async (modelName) => {
    return await GLPIImportHelpers.findOrCreateEntity(ComputerModelService, modelName);
  },

  resolveUser: async (userName) => {
    if (!userName || !userName.trim()) return null;
    
    const parts = userName.split(' ');
    const generatedName = userName.replace(/\s+/g, '.').toLowerCase(); // username (login)
    
    try {
      const items = await UserService.getAllUsers();
      // Chercher par name ou realname ou login généré
      const existing = items.find(item => 
        (item.name && item.name.toLowerCase() === generatedName) ||
        (item.name && item.name.toLowerCase() === userName.toLowerCase()) ||
        (item.realname && item.realname.toLowerCase() === userName.toLowerCase())
      );
      if (existing) return existing.id;
    } catch(e) {
      console.warn('Erreur lors de la récupération des utilisateurs:', e.message);
    }
    
    try {
      const realname = parts.length > 0 ? parts[0] : ''; // Nom de famille
      const firstname = parts.length > 1 ? parts.slice(1).join(' ') : ''; // Prénom(s)
      
      const response = await UserService.createUser({
        name: generatedName,
        realname: realname,
        firstname: firstname,
        is_active: 1
      });
      return response.id;
    } catch(e) {
      // Si l'erreur est "L'utilisateur existe déjà", on essaie de le retrouver à nouveau via l'API (s'il n'était pas dans la liste initiale pour une raison X)
      if (e.response?.data && Array.isArray(e.response.data) && e.response.data.includes('ERROR_GLPI_ADD')) {
         console.warn(`L'utilisateur ${generatedName} existe déjà (selon l'API GLPI), tentative de récupération...`);
         try {
             const items = await UserService.getAllUsers();
             const existing = items.find(item => item.name && item.name.toLowerCase() === generatedName);
             if (existing) return existing.id;
         } catch(e2) {
             console.error('Impossible de récupérer l\'utilisateur existant:', e2.message);
         }
      } else {
        console.error('Erreur lors de la création de l\'utilisateur:', e.response?.data || e.message);
      }
      return null;
    }
  },
  
  resolveItem: async (itemName) => {
    if (!itemName || !itemName.trim()) return null;
    
    // Essayer de chercher dans les Computers
    try {
      const items = await ComputerService.getAllComputers();
      const existing = items.find(item => item.name && item.name.toLowerCase() === itemName.toLowerCase());
      if (existing) return { id: existing.id, type: 'Computer' };
    } catch(e) {
      console.warn(e);
    }
    
    // Liste des autres types d'équipements possibles dans GLPI
    const otherTypes = ['Monitor', 'Printer', 'NetworkEquipment', 'Phone', 'Peripheral', 'Enclosure', 'PDU', 'Rack', 'Software'];
    
    try {
      const { default: api } = await import('../../config/api');
      
      // On boucle sur chaque type d'équipement
      for (const type of otherTypes) {
        try {
          const response = await api.get(`/${type}`);
          const items = response.data;
          const existing = items.find(item => item.name && item.name.toLowerCase() === itemName.toLowerCase());
          if (existing) return { id: existing.id, type: type };
        } catch (e) {
          // L'API peut retourner une erreur 400/404 si le endpoint n'existe pas ou s'il n'y a pas de droits, on ignore et on passe au suivant
          // console.warn(`Erreur lors de la recherche dans ${type}`, e);
        }
      }
    } catch(e) {
      console.warn('Erreur globale lors de la recherche des autres équipements', e);
    }
    
    return null;
  }
};

// Patching the GLPIImportHelpers to work dynamically if the methods differ
LocationService.name = 'LocationService';
ManufacturerService.name = 'ManufacturerService';
StateService.name = 'StateService';
ComputerModelService.name = 'ComputerModelService';
UserService.name = 'UserService';
ComputerService.name = 'ComputerService';

export default GLPIImportHelpers;
