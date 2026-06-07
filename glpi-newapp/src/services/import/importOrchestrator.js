import { validateAssetCSV } from './validators/assetValidator';
import { validateTicketCSV } from './validators/ticketValidator';
import { validateCostCSV } from './validators/costValidator';
import { lookupCache } from './helpers/lookupCache';
import { importAssets } from './assetImportService';
import { importTickets } from './ticketImportService';
import { importCosts } from './costImportService';
import { importImages } from './imageImportService';
import { readFileText } from './helpers/csvParser';

export async function runImport({ feuille1, feuille2, feuille3, zipFile = null }) {
  // ÉTAPE 1 — Lire les 3 fichiers en parallèle
  const [text1, text2, text3] = await Promise.all([
    readFileText(feuille1),
    readFileText(feuille2),
    readFileText(feuille3),
  ]);

  // ÉTAPE 2 — Valider les 3 fichiers AVANT tout appel GLPI
  const v1 = validateAssetCSV(text1);
  const v2 = validateTicketCSV(text2);
  const v3 = validateCostCSV(text3);

  if (!v1.valid || !v2.valid || !v3.valid) {
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

  // ÉTAPE 4 — Importer dans l'ordre (séquentiel)
  const assetsResult = await importAssets(text1);
  const ticketsResult = await importTickets(text2, assetsResult.nameToItem);
  const costsResult = await importCosts(text3, ticketsResult.refToId);

  // ÉTAPE 5 — Import des images (optionnel)
  const imagesResult = await importImages(zipFile, assetsResult.nameToItem);

  // ÉTAPE 6 — Retourner le rapport complet
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
}
