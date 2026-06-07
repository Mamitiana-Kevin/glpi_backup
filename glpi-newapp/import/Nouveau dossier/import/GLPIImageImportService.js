import JSZip from 'jszip';
import api, { initSession } from '../../config/api';

/**
 * SERVICE : GLPIImageImportService
 * RÔLE    : Extraire les images d'un fichier ZIP, les uploader comme
 *           Documents dans GLPI, et les associer aux équipements
 *           (Computer, Monitor, etc.) retrouvés par leur nom.
 *
 * Convention de nommage des images :
 *   <NomEquipement>.<png|jpg|jpeg>
 *   Exemple : PC-ADM-001.png  →  associé à l'équipement nommé "PC-ADM-001"
 *             MN-FORM-002.png →  associé à l'équipement nommé "MN-FORM-002"
 *
 * Flux GLPI REST API :
 *   1. POST /Document            → upload du fichier (multipart/form-data)
 *   2. POST /Document_Item       → liaison Document ↔ Équipement
 */

// Types d'équipements GLPI à chercher (dans l'ordre)
const ITEM_TYPES = [
  'Computer',
  'Monitor',
  'Printer',
  'NetworkEquipment',
  'Phone',
  'Peripheral',
  'PDU',
  'Rack',
  'Software',
];

/**
 * Convertit un fichier PNG en JPEG via le Canvas API du navigateur.
 * GLPI peut rejeter les PNG silencieusement (filepath = NULL en BDD)
 * si le type MIME image/png n'est pas dans ses types autorisés.
 * La conversion garantit que l'image est toujours uploadée en JPEG.
 *
 * @param {File} file - Le fichier PNG source
 * @returns {Promise<File>} - Un fichier JPEG équivalent
 */
const convertPngToJpeg = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      // Fond blanc pour remplacer la transparence PNG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error(`Conversion PNG→JPEG échouée pour ${file.name}`));
            return;
          }
          const jpegName = file.name.replace(/\.png$/i, '.jpg');
          resolve(new File([blob], jpegName, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92 // qualité JPEG 92%
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Impossible de charger l'image PNG : ${file.name}`));
    };

    img.src = objectUrl;
  });
};

const GLPIImageImportService = {
  /**
   * Extrait les images d'un ZIP.
   * Retourne un objet { [basename_sans_extension]: File }
   */
  extractImagesFromZip: async (zipFile) => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const images = {};

    for (const [filename, fileEntry] of Object.entries(contents.files)) {
      if (fileEntry.dir) continue;

      const lower = filename.toLowerCase();
      if (!lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.jpeg')) {
        continue;
      }

      // On garde uniquement le nom de fichier (sans chemin de dossier)
      const baseName = filename.split('/').pop();
      const nameWithoutExt = baseName.replace(/\.(png|jpg|jpeg)$/i, '');
      const mimeType = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';

      const blob = await fileEntry.async('blob');
      const imageFile = new File([blob], baseName, { type: mimeType });
      images[nameWithoutExt] = imageFile;
    }

    console.log('📦 Images extraites du ZIP:', Object.keys(images));
    return images;
  },

  /**
   * Cherche un équipement dans GLPI par son nom.
   * Retourne { id, itemtype } ou null.
   */
  findItemByName: async (name) => {
    await initSession();

    for (const itemtype of ITEM_TYPES) {
      try {
        const response = await api.get(`/${itemtype}`, {
          params: {
            searchText: name,
            range: '0-50',
          },
        });

        const items = Array.isArray(response.data) ? response.data : [];
        const found = items.find(
          (item) => item.name && item.name.toLowerCase() === name.toLowerCase()
        );

        if (found) {
          console.log(`✅ Équipement trouvé : ${name} → ${itemtype} ID=${found.id}`);
          return { id: found.id, itemtype };
        }
      } catch (e) {
        // L'endpoint peut ne pas exister ou retourner une erreur — on continue
        // console.warn(`Recherche dans ${itemtype} échouée`, e.message);
      }
    }

    console.warn(`⚠️ Équipement introuvable pour : ${name}`);
    return null;
  },

  /**
   * Upload une image comme Document GLPI.
   * Convertit automatiquement les PNG en JPEG avant l'envoi
   * car GLPI peut rejeter les PNG si le type n'est pas autorisé
   * (résultat : filename=NULL, filepath=NULL en BDD).
   *
   * @param {File}   imageFile     - Le fichier image (png/jpg/jpeg)
   * @param {string} equipmentName - Le nom de l'équipement (pour le nom du document)
   * @returns {Promise<number>}    - L'ID du document GLPI créé
   */
  uploadDocument: async (imageFile, equipmentName) => {
    await initSession();

    // --- Conversion PNG → JPEG ---
    let fileToUpload = imageFile;
    if (imageFile.name.toLowerCase().endsWith('.png')) {
      console.log(`🔄 Conversion PNG→JPEG : ${imageFile.name}`);
      fileToUpload = await convertPngToJpeg(imageFile);
      console.log(`✅ Converti en : ${fileToUpload.name}`);
    }

    const formData = new FormData();

    // Métadonnées du document (JSON stringifié dans le champ 'uploadManifest')
    // _filename doit correspondre exactement au nom du fichier envoyé
    const manifest = {
      input: {
        name: `Photo - ${equipmentName}`,
        _filename: [fileToUpload.name],
      },
    };
    formData.append('uploadManifest', JSON.stringify(manifest));
    // Le champ 'filename[0]' est le nom attendu par l'API GLPI REST
    formData.append('filename[0]', fileToUpload, fileToUpload.name);

    // Ne PAS forcer Content-Type manuellement : Axios doit le détecter
    // automatiquement depuis FormData pour inclure le boundary multipart.
    const response = await api.post('/Document', formData, {
      headers: {
        'Content-Type': undefined, // Laisse Axios gérer le boundary multipart
      },
    });

    const documentId = response.data?.id || response.data?.[0]?.id;
    if (!documentId) {
      throw new Error(`Upload échoué pour ${fileToUpload.name} — pas d'ID retourné par GLPI`);
    }

    console.log(`📄 Document créé : ID=${documentId} pour "${equipmentName}" (fichier: ${fileToUpload.name})`);
    return documentId;
  },

  /**
   * Lie un Document à un équipement GLPI.
   * Utilise l'endpoint /Document_Item.
   */
  linkDocumentToItem: async (documentId, itemId, itemtype) => {
    await initSession();

    const response = await api.post('/Document_Item', {
      input: {
        documents_id: documentId,
        items_id: itemId,
        itemtype: itemtype,
      },
    });

    return response.data;
  },

  /**
   * Point d'entrée principal.
   * Importe toutes les images d'un ZIP et les associe aux équipements GLPI.
   *
   * @param {File}     zipFile    - Le fichier ZIP contenant les images
   * @param {Function} onProgress - Callback de progression (0-100)
   * @returns {{ success: number, errors: number, details: Array }}
   */
  importImages: async (zipFile, onProgress = null) => {
    const images = await GLPIImageImportService.extractImagesFromZip(zipFile);
    const results = { success: 0, errors: 0, details: [] };

    const references = Object.keys(images);
    const total = references.length;
    let processed = 0;

    for (const name of references) {
      try {
        // 1. Chercher l'équipement
        const itemInfo = await GLPIImageImportService.findItemByName(name);

        if (!itemInfo) {
          results.errors++;
          results.details.push({
            reference: name,
            status: 'error',
            message: `Équipement "${name}" introuvable dans GLPI`,
          });
        } else {
          // 2. Uploader le document
          const documentId = await GLPIImageImportService.uploadDocument(
            images[name],
            name
          );

          // 3. Lier le document à l'équipement
          await GLPIImageImportService.linkDocumentToItem(
            documentId,
            itemInfo.id,
            itemInfo.itemtype
          );

          results.success++;
          results.details.push({
            reference: name,
            itemtype: itemInfo.itemtype,
            itemId: itemInfo.id,
            documentId,
            status: 'success',
            message: `"${name}" → ${itemInfo.itemtype} ID=${itemInfo.id} (Document ID=${documentId})`,
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          reference: name,
          status: 'error',
          message: `"${name}" : ${error.message || 'Erreur inconnue'}`,
        });
      }

      processed++;
      if (onProgress) {
        onProgress(Math.round((processed / total) * 100));
      }
    }

    return results;
  },
};

export default GLPIImageImportService;
