/**
 * storage.js
 * -----------------------------------------------------------------------
 * Wraps localStorage for three jobs:
 *   1. Caching API responses (so re-searching a city is instant + free)
 *   2. Favorite cities list
 *   3. Small user preferences (unit, last searched city)
 * -----------------------------------------------------------------------
 */

class StorageService {
  constructor() {
    this.cacheKey = CONFIG.STORAGE_KEYS.CACHE;
    this.favoritesKey = CONFIG.STORAGE_KEYS.FAVORITES;
    this.unitKey = CONFIG.STORAGE_KEYS.UNIT;
    this.lastCityKey = CONFIG.STORAGE_KEYS.LAST_CITY;
  }

  _readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn(`Storage read failed for "${key}":`, err);
      return fallback;
    }
  }

  _writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn(`Storage write failed for "${key}":`, err);
      return false;
    }
  }

  // ---------- Cache ----------
  getCache(cacheKey) {
    const store = this._readJSON(this.cacheKey, {});
    const entry = store[cacheKey];
    if (entry && Date.now() - entry.timestamp < CONFIG.CACHE_DURATION_MS) {
      return entry.data;
    }
    return null;
  }

  setCache(cacheKey, data) {
    const store = this._readJSON(this.cacheKey, {});
    store[cacheKey] = { data, timestamp: Date.now() };
    this._writeJSON(this.cacheKey, store);
  }

  clearCache() {
    localStorage.removeItem(this.cacheKey);
  }

  // ---------- Favorites ----------
  getFavorites() {
    return this._readJSON(this.favoritesKey, []);
  }

  isFavorite(id) {
    return this.getFavorites().some(city => city.id === id);
  }

  toggleFavorite(city) {
    let favorites = this.getFavorites();
    const exists = favorites.some(c => c.id === city.id);

    if (exists) {
      favorites = favorites.filter(c => c.id !== city.id);
    } else {
      if (favorites.length >= CONFIG.MAX_FAVORITES) {
        favorites.shift(); // drop oldest to make room
      }
      favorites.push(city);
    }

    this._writeJSON(this.favoritesKey, favorites);
    return !exists; // returns new "is favorite" state
  }

  // ---------- Preferences ----------
  getUnit() {
    return localStorage.getItem(this.unitKey) || 'celsius';
  }

  setUnit(unit) {
    localStorage.setItem(this.unitKey, unit);
  }

  getLastCity() {
    return this._readJSON(this.lastCityKey, null);
  }

  setLastCity(city) {
    this._writeJSON(this.lastCityKey, city);
  }
}
