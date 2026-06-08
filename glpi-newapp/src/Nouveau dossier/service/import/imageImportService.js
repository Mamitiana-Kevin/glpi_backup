import JSZip from 'jszip';
import { Legacy, legacy } from '../../api/glpiClient';

const ACCEPTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'];

function getExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

function getAssetName(filename) {
  return filename.split('/').pop().replace(/\.[^/.]+$/, "");
}

function getMimeType(extension) {
  const mimeTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'svg': 'image/svg+xml'
  };
  return mimeTypes[extension] || 'application/octet-stream';
}

async function uploadDocument(assetName, fileBlob, extension, item) {
  try {
    // Étape 1 — Créer le document dans GLPI via multipart
    const formData = new FormData();
    formData.append(
      'uploadManifest',
      JSON.stringify({ input: { name: assetName } })
    );
    formData.append(
      'filename[0]',
      new File([fileBlob], `${assetName}.${extension}`, { type: getMimeType(extension) })
    );

    // Utiliser l'instance legacy directement car multipart
    const response = await legacy.post('/Document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    
    const documentId = response.data?.id ?? response.data?.[0]?.id;

    if (!documentId) {
      throw new Error("Impossible de récupérer l'ID du document créé.");
    }

    // Étape 2 — Lier le document à l'asset
    await Legacy.post('Document_Item', {
      documents_id: documentId,
      items_id: item.id,
      itemtype: item.itemtype,
    });

    return { assetName, success: true, documentId };
  } catch (error) {
    console.error(`Error uploading image for ${assetName}:`, error);
    return { assetName, success: false, error: error.response?.data?.message || error.message };
  }
}

export async function importImages(zipFile, nameToItem = {}, onProgress = () => {}) {
  if (!zipFile) {
    return { skipped: true, results: [] };
  }

  try {
    onProgress("Extraction du fichier ZIP...");
    const zip = await JSZip.loadAsync(zipFile);
    const results = [];

    const filePromises = [];

    zip.forEach((relativePath, file) => {
      // Ignorer les dossiers et fichiers système
      if (file.dir || relativePath.startsWith('__MACOSX/') || relativePath.includes('.DS_Store')) {
        return;
      }

      const extension = getExtension(relativePath);
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        return;
      }

      const assetName = getAssetName(relativePath);
      const item = nameToItem[assetName];

      if (!item) {
        onProgress(`Avertissement : Image ${assetName} ignorée (asset non trouvé dans le CSV)`);
        return;
      }

      // Extraire le blob et uploader
      const promise = file.async('blob').then(fileBlob => {
        onProgress(`Upload de l'image pour ${assetName}...`);
        return uploadDocument(assetName, fileBlob, extension, item);
      }).then(res => {
        results.push(res);
      });

      filePromises.push(promise);
    });

    await Promise.all(filePromises);

    return {
      skipped: false,
      results
    };
  } catch (error) {
    console.error("Error processing ZIP file:", error);
    throw new Error(`Échec critique sur le traitement des images : ${error.message}`);
  }
}
