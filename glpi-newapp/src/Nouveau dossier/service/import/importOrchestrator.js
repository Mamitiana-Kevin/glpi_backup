import { validateAssetCSV } from './validators/assetValidator';
import { validateTicketCSV } from './validators/ticketValidator';
import { validateCostCSV } from './validators/costValidator';
import { lookupCache } from './helpers/lookupCache';
import { importAssets } from './assetImportService';
import { importAssetsLegacy } from './assetImportLegacyService';
import { importTickets } from './ticketImportService';
import { importCosts } from './costImportService';
import { importImages } from './imageImportService';
import { readFileText } from './helpers/csvParser';
import { purgeAll } from '../resetService';

export async function runImport({ feuille1, feuille2, feuille3, zipFile = null }, onLog = () => {}) {
  // ÉTAPE 1 — Lire les 3 fichiers en parallèle
  onLog("Lecture des fichiers CSV...");
  const [text1, text2, text3] = await Promise.all([
    readFileText(feuille1),
    readFileText(feuille2),
    readFileText(feuille3),
  ]);

  // ÉTAPE 2 — Valider les 3 fichiers AVANT tout appel GLPI
  onLog("Validation de la structure des fichiers...");
  const v1 = validateAssetCSV(text1);
  const v2 = validateTicketCSV(text2);
  const v3 = validateCostCSV(text3);

  if (!v1.valid || !v2.valid || !v3.valid) {
    onLog("Erreur : La validation des fichiers a échoué.");
    return {
      success: false,
      validationErrors: {
        feuille1: v1.errors,
        feuille2: v2.errors,
        feuille3: v3.errors,
      }
    };
  }

  // ÉTAPE 3 — Vider le cache lookup
  lookupCache.clear();

  try {
    // ÉTAPE 4 — Importer dans l'ordre (séquentiel)
    onLog("Début de l'importation des assets (Legacy)...");
    const assetsResult = await importAssetsLegacy(text1, onLog);
    
    onLog("Début de l'importation des tickets...");
    const ticketsResult = await importTickets(text2, assetsResult.nameToItem, onLog);
    
    onLog("Début de l'importation des coûts...");
    const costsResult = await importCosts(text3, ticketsResult.refToId, onLog);

    // ÉTAPE 5 — Import des images (optionnel)
    let imagesResult = { skipped: true, results: [] };
    if (zipFile) {
      onLog("Début de l'importation des images...");
      imagesResult = await importImages(zipFile, assetsResult.nameToItem, onLog);
    }

    // ÉTAPE 6 — Retourner le rapport complet
    onLog("Importation terminée avec succès !");
    const stats = {
      assets: {
        total: assetsResult.results.length,
        success: assetsResult.results.filter(r => r.success).length,
        failed: assetsResult.results.filter(r => !r.success).length,
      },
      tickets: {
        total: ticketsResult.results.length,
        success: ticketsResult.results.filter(r => r.success).length,
        failed: ticketsResult.results.filter(r => !r.success).length,
      },
      costs: {
        total: costsResult.length,
        success: costsResult.filter(r => r.success).length,
        failed: costsResult.filter(r => !r.success).length,
      },
      images: imagesResult.skipped
        ? { skipped: true }
        : {
            total: imagesResult.results.length,
            success: imagesResult.results.filter(r => r.success).length,
            failed: imagesResult.results.filter(r => !r.success).length,
          }
    };

    return {
      success: true,
      stats,
      details: {
        assets: assetsResult.results,
        tickets: ticketsResult.results,
        costs: costsResult,
        images: imagesResult.results,
      }
    };
  } catch (error) {
    // LOGIQUE TOUT OU RIEN : En cas d'erreur, on reset TOUT
    onLog(`ERREUR CRITIQUE : ${error.message}`);
    onLog("Lancement de la procédure d'annulation (Rollback / Reset)...");
    
    try {
      await purgeAll();
      onLog("Annulation terminée. GLPI a été remis à zéro.");
    } catch (resetError) {
      onLog(`Erreur lors de l'annulation : ${resetError.message}`);
    }

    return {
      success: false,
      error: error.message,
      rolledBack: true
    };
  }
}
