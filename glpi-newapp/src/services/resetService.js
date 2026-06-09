import { Legacy } from "../api/glpiClient";

const allAPI = [
    // 1. On commence par les éléments qui dépendent des autres (Tickets, Assets)
    { url: 'Ticket', ids: null },
    { url: 'Document', ids: null },
    
    { url: 'Computer', ids: null },
    { url: 'Monitor', ids: null },
    { url: 'Peripheral', ids: null },
    { url: 'Printer', ids: null },
    { url: 'Phone', ids: null },
    { url: 'NetworkEquipment', ids: null },
    { url: 'Rack', ids: null },
    { url: 'Enclosure', ids: null },
    { url: 'PDU', ids: null },
    { url: 'PassiveDCEquipment', ids: null },
    { url: 'Cable', ids: null },
    { url: 'Unmanaged', ids: null },
    { url: 'DCRoom', ids: null },
    { url: 'Database', ids: null },

    // 2. Logiciels
    { url: 'Software', ids: null },
    { url: 'SoftwareLicense', ids: null },

    // 3. Consommables
    { url: 'ConsumableItem', ids: null },
    { url: 'CartridgeItem', ids: null },

    // 4. Modèles (utilisés par les assets)
    { url: 'ComputerModel', ids: null },
    { url: 'MonitorModel', ids: null },
    { url: 'PeripheralModel', ids: null },
    { url: 'PrinterModel', ids: null },
    { url: 'PhoneModel', ids: null },
    { url: 'NetworkEquipmentModel', ids: null },
    { url: 'RackModel', ids: null },
    { url: 'EnclosureModel', ids: null },
    { url: 'PDUModel', ids: null },
    { url: 'PassiveDCEquipmentModel', ids: null },
    { url: 'DatabaseModel', ids: null },

    // 5. Dropdowns et Utilisateurs
    { url: 'State', ids: null },
    { url: 'Location', ids: null },
    { url: 'Manufacturer', ids: null },
    { url: 'Supplier', ids: null },
    { url: 'User', ids: null }
];

async function getIdsPour(entityName) {
    // 1. On cherche la bonne ligne dans ton tableau
    const targetEntity = allAPI.find(api => api.url === entityName);

    // Sécurité : si l'entité n'est pas dans le tableau
    if (!targetEntity) {
        console.error("Entité non reconnue");
        return [];
    }

    // 2. Si le tableau d'IDs est déjà rempli, on le renvoie instantanément
    if (targetEntity.ids !== null) {
        console.log(`IDs récupérés depuis allAPI pour ${entityName}`);
        return targetEntity.ids;
    }

    // 3. Si c'est vide, on déclenche l'appel réseau
    try {
        // On récupère les éléments actifs
        const response = await Legacy.get('/'+entityName, { range: '0-1000' });
        const data = response.data;
        const activeIds = Array.isArray(data) ? data.map(item => item.id) : [];

        // On tente aussi de récupérer les éléments déjà dans la corbeille (is_deleted=1)
        let deletedIds = [];
        try {
            const responseDeleted = await Legacy.get('/'+entityName, { is_deleted: 1, range: '0-1000' });
            if (Array.isArray(responseDeleted.data)) {
                deletedIds = responseDeleted.data.map(item => item.id);
            }
        } catch (e) {
            // L'entité ne supporte peut-être pas la corbeille
        }
        
        // Fusion des deux listes (sans doublons)
        let allIds = [...new Set([...activeIds, ...deletedIds])];

        // PROTECTION : Ne jamais supprimer les utilisateurs par défaut de GLPI
        if (entityName === 'User') {
            const defaultUserIds = [2, 3, 4, 5, 6]; // glpi, post-only, tech, normal, cron
            allIds = allIds.filter(id => !defaultUserIds.includes(id));
        }

        // PROTECTION : Ne pas supprimer les données d'usine/système pour les dropdowns et modèles
        const protectedEntities = [
            'State', 'Location', 'Manufacturer', 'Supplier', 
            'ComputerModel', 'MonitorModel', 'PeripheralModel', 
            'PrinterModel', 'PhoneModel', 'NetworkEquipmentModel',
            'RackModel', 'EnclosureModel', 'PDUModel', 'PassiveDCEquipmentModel',
            'DatabaseModel'
        ];
        if (protectedEntities.includes(entityName)) {
            allIds = allIds.filter(id => id > 20); // On garde les 20 premiers IDs par sécurité
        }
        
        targetEntity.ids = allIds;
        
        return targetEntity.ids;
    } catch (error) {
        console.error("Erreur de fetch", error);
        return [];
    }
}

async function purgeAll(selectedEntities = allAPI.map((entity) => entity.url), onProgress = () => {}) {
    const purgeResults = [];
    const entitiesToPurge = allAPI.filter((entity) => selectedEntities.includes(entity.url));

    for (const entity of entitiesToPurge) {
        onProgress({ entity: entity.url, status: 'running' });

        try {
            const ids = await getIdsPour(entity.url);
            let successCount = 0;
            let failureCount = 0;

            for (const id of ids) {
                try {
                    await Legacy.delPurge(`/${entity.url}/${id}`);
                    purgeResults.push({ entity: entity.url, id, success: true });
                    successCount += 1;
                } catch (error) {
                    console.error(`Erreur de purge pour ${entity.url} #${id}`, error);
                    purgeResults.push({ entity: entity.url, id, success: false, error });
                    failureCount += 1;
                }
            }

            onProgress({
                entity: entity.url,
                status: failureCount > 0 ? 'warning' : 'success',
                total: ids.length,
                successCount,
                failureCount,
            });

        } catch (error) {
            console.error(`Erreur inattendue pendant la purge de ${entity.url}`, error);
            onProgress({
                entity: entity.url,
                status: 'error',
                total: 0,
                successCount: 0,
                failureCount: 0,
                error,
            });
        } finally {
            entity.ids = [];
        }
    }

    return purgeResults;
}

export { allAPI, getIdsPour, purgeAll };