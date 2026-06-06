import { Legacy } from "../api/glpiClient";

const allAPI = [
    { url: 'Computer', ids: null },
    { url: 'Monitor', ids: null },
    { url: 'Peripheral', ids: null },
    { url: 'Printer', ids: null },
    { url: 'Phone', ids: null },
    { url: 'NetworkEquipment', ids: null },

    // Consommables & Accessoires
    { url: 'ConsumableItem', ids: null },
    { url: 'CartridgeItem', ids: null },

    // Organisation & Logistique
    { url: 'Location', ids: null },
    { url: 'Manufacturer', ids: null },
    { url: 'Supplier', ids: null },

    // SAV & Assistance
    { url: 'Ticket', ids: null },
    { url: 'Software', ids: null },
    { url: 'SoftwareLicense', ids: null }
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
        targetEntity.ids = [...new Set([...activeIds, ...deletedIds])];
        
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