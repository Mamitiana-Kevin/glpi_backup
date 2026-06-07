# Documentation Technique — GLPI NewApp

Ce document récapitule tout ce qu'il faut savoir pour développer sur le projet : utilisation du client API, du CSS global, de React et des syntaxes JavaScript essentielles.

---

## 1. Utilisation de `glpiClient.js`

Le client est situé dans `src/api/glpiClient.js`. Il gère deux APIs : la **V2 (OAuth2)** pour le quotidien et la **Legacy (v1)** pour les actions spécifiques (purge, relations).

### 🟢 API V2 (Standard)
Utilisée pour 90% des besoins (Assets, Tickets, Dashboard).

```javascript
import { get, post, put, del } from '../api/glpiClient';

// GET : Récupérer des données
// Note : Toujours préfixer par /Assets/ pour le matériel
const computers = await get('/Assets/Computer', { range: '0-10' });

// POST : Créer un élément (Le payload est direct)
const newTicket = await post('/Assistance/Ticket', {
  name: "Problème écran",
  content: "L'écran scintille",
  impact: 3,
  urgency: 3
});

// PUT : Modifier un élément
await put(`/Assets/Monitor/${id}`, { name: "Nouveau Nom" });

// DELETE : Mettre à la corbeille
await del(`/Assets/Computer/${id}`);
```

### 🔴 API Legacy (Spécifique)
Utilisée pour le **Reset (purge)** et les **Liaisons (Item_Ticket)**.

```javascript
import { Legacy } from '../api/glpiClient';

// GET : Récupérer
const data = await Legacy.get('/Computer');

// POST : Créer (Wrappe automatiquement dans { input: data })
// Ne pas rajouter { input: ... } vous-même !
await Legacy.post('/Item_Ticket', {
  tickets_id: 123,
  items_id: 45,
  itemtype: 'Computer'
});

// DELETE PURGE : Suppression définitive (vide la corbeille)
await Legacy.delPurge(`/Computer/${id}`);
```

---

## 2. Guide CSS (`All.css`)

Le fichier `src/assets/css/All.css` contient des classes utilitaires et des composants pré-stylisés.

### Exemple Complet : Un Composant de Liste d'Assets
Voici comment structurer un composant React pour utiliser le design système du projet :

```jsx
import React from 'react';
import '../../assets/css/All.css';

export default function AssetList({ assets }) {
  return (
    <div className="page-container">
      <header className="page-header">
        <h2>Gestion du Parc</h2>
        <p>Liste des équipements importés</p>
      </header>

      <div className="glpi-card">
        <div className="table-wrapper">
          <table className="glpi-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => (
                <tr key={asset.id}>
                  <td>{asset.name}</td>
                  <td>
                    <span className={`badge status-${asset.states_id}`}>
                      {asset.status_name}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-primary btn-icon">👁️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

---

## 3. React : `useState` et `useEffect`

### `useState` (Gestion de l'état)
Utilisé pour stocker des données qui changent (résultats API, saisie formulaire, chargement).

```javascript
const [items, setItems] = useState([]); // Pour une liste
const [loading, setLoading] = useState(false); // Pour un spinner
const [error, setError] = useState(null); // Pour les messages d'erreur

// Exemple : Mettre à jour un champ de formulaire
const handleChange = (e) => {
  setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
};
```

### `useEffect` (Actions au chargement)
Utilisé pour appeler l'API quand le composant apparaît.

```javascript
useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await get('/Assets/Computer');
      setItems(res.data);
    } catch (err) {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []); // [] signifie : "Exécuter une seule fois au montage"
```

---

## 4. JavaScript Moderne (Syntaxe utile)

### Manipulation d'Objets et Tableaux
- **Spread Operator (`...`)** : Pour copier ou fusionner.
```javascript
const nouveauTicket = { ...ancienTicket, name: "Nouveau Nom" };
const nouvelleListe = [...ancienneListe, nouvelItem];
```

- **Destructuration** : Pour extraire proprement.
```javascript
const { name, content } = row; // Au lieu de row.name, row.content
const [first, second] = monTableau;
```

### Méthodes de Tableaux (Indispensables)
- **`.map()`** : Transformer (très utilisé pour afficher des listes en React).
- **`.filter()`** : Garder certains éléments (ex: supprimer un item de la liste).
- **`.find()`** : Trouver UN élément précis.
- **`.some()` / `.every()`** : Vérifier des conditions.

### Promesses et Async/Await
- **`Promise.all`** : Pour lancer plusieurs appels en parallèle (gain de temps).
```javascript
const [res1, res2] = await Promise.all([
  get('/Assets/Computer'),
  get('/Assets/Monitor')
]);
```

- **Try / Catch** : Toujours entourer vos appels API pour éviter que l'application ne plante en cas d'erreur réseau.
