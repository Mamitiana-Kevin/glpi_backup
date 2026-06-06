const APP_TOKEN = 'nzJu5tfBe4JbVW9tkwAB4jSKgXUCCD3WOVEBuz4H';
const BASE_URL = 'http://localhost/glpi/apirest.php';
const USERNAME = 'glpi'; 
const PASSWORD = 'glpi';

async function testFinalGLPI() {
  console.log("📡 Tentative de connexion avec App-Token strict dans le Header...");

  const credentials = btoa(`${USERNAME}:${PASSWORD}`);

  try {
    const response = await fetch(`${BASE_URL}/initSession`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'App-Token': APP_TOKEN, // Majuscule à Token ici
        'Authorization': `Basic ${credentials}`
      }
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log("Réponse complète :", data);
  } catch (error) {
    console.log("Erreur :", error.message);
  }
}

testFinalGLPI();