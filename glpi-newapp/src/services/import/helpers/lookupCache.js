import { Legacy } from '../../../api/glpiClient';

const cache = new Map();

export const lookupCache = {
  clear() {
    cache.clear();
  },

  async resolveDropdown(glpiType, name) {
    if (!name) return null;
    const cacheKey = `${glpiType}::${name}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    try {
      const { data } = await Legacy.get(`/${glpiType}`, { searchText: name });
      // S'assurer que data est un tableau
      const items = Array.isArray(data) ? data : [];
      const found = items.find(item => item.name === name);
      
      if (found) {
        cache.set(cacheKey, found.id);
        return found.id;
      }

      // If not found, create it
      const createRes = await Legacy.post(`/${glpiType}`, { name });
      const newId = createRes.data.id;
      cache.set(cacheKey, newId);
      return newId;
    } catch (error) {
      console.error(`Error resolving dropdown ${glpiType} for ${name}:`, error);
      return null;
    }
  },

  async resolveUser(fullName) {
    if (!fullName || !fullName.trim()) return null;
    
    const parts = fullName.trim().split(/\s+/);
    const lastname = parts[0].toUpperCase();
    const firstname = parts.slice(1).join(" ");
    
    // Login : lastname.firstname (sans point si pas de prénom)
    const login = firstname 
      ? `${lastname.toLowerCase()}.${firstname.toLowerCase().replace(/\s+/g, ".")}`
      : lastname.toLowerCase();

    const cacheKey = `user::${login}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    try {
      const { data } = await Legacy.get("/User", { searchText: login });
      // S'assurer que data est un tableau
      const users = Array.isArray(data) ? data : [];
      const found = users.find(user => user.name === login || user.realname === lastname);

      if (found) {
        cache.set(cacheKey, found.id);
        return found.id;
      }

      // If not found, create it
      // IMPORTANT: Dans l'API Legacy GLPI, le login est 'name' et le nom est 'realname'
      const createRes = await Legacy.post("/User", {
        name: login,
        firstname: firstname || "",
        realname: lastname,
        password: "Glpi1234!",
        _profiles_id: 4,
        _entities_id: 0
      });
      const newId = createRes.data.id;
      cache.set(cacheKey, newId);
      return newId;
    } catch (error) {
      console.error(`Error resolving user ${fullName}:`, error);
      return null;
    }
  }
};
