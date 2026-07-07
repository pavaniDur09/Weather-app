/**
 * config.js
 * -----------------------------------------------------------------------
 * Central configuration for the weather app — now wired to OpenWeatherMap.
 *
 * API KEY SETUP:
 * Browsers can't read a ".env" file directly (there's no build step here),
 * so the key lives in js/env.js instead - a tiny file that's gitignored
 * so you never accidentally commit your key. See js/env.example.js for
 * the template, and the README for full setup steps.
 * -----------------------------------------------------------------------
 */

const CONFIG = {
  OWM_API_KEY: (typeof window !== 'undefined' && window.OWM_API_KEY) || '',

  GEO_DIRECT_URL: 'https://api.openweathermap.org/geo/1.0/direct',
  GEO_REVERSE_URL: 'https://api.openweathermap.org/geo/1.0/reverse',
  WEATHER_URL: 'https://api.openweathermap.org/data/2.5/weather',
  FORECAST_URL: 'https://api.openweathermap.org/data/2.5/forecast',

  CACHE_DURATION_MS: 10 * 60 * 1000, // 10 minutes
  MAX_FAVORITES: 8,
  MAX_SUGGESTIONS: 5,
  SEARCH_DEBOUNCE_MS: 350,

  STORAGE_KEYS: {
    CACHE: 'weatherApp_cache',
    FAVORITES: 'weatherApp_favorites',
    UNIT: 'weatherApp_unit',
    LAST_CITY: 'weatherApp_lastCity'
  },

  // Maps OpenWeatherMap's numeric condition "id" to a label/icon/mood.
  // Reference: https://openweathermap.org/weather-conditions
  weatherCodeInfo(id, description) {
    const label = description
      ? description.charAt(0).toUpperCase() + description.slice(1)
      : 'Unknown';

    if (id >= 200 && id < 300) {
      const heavy = [211, 212, 221, 232].includes(id);
      return { label, icon: heavy ? 'storm-hail' : 'storm', mood: 'storm' };
    }
    if (id >= 300 && id < 400) return { label, icon: 'drizzle', mood: 'rain' };
    if (id >= 500 && id < 600) {
      if (id === 511) return { label, icon: 'sleet', mood: 'rain' };
      if ([520, 521].includes(id)) return { label, icon: 'showers', mood: 'rain' };
      if ([522, 531].includes(id)) return { label, icon: 'showers-heavy', mood: 'rain' };
      if ([502, 503, 504].includes(id)) return { label, icon: 'rain-heavy', mood: 'rain' };
      return { label, icon: 'rain', mood: 'rain' };
    }
    if (id >= 600 && id < 700) {
      if ([611, 612, 613, 615, 616].includes(id)) return { label, icon: 'sleet', mood: 'snow' };
      if ([602, 622].includes(id)) return { label, icon: 'snow-heavy', mood: 'snow' };
      return { label, icon: 'snow', mood: 'snow' };
    }
    if (id >= 700 && id < 800) return { label, icon: 'fog', mood: 'fog' };
    if (id === 800) return { label, icon: 'clear-day', mood: 'sun' };
    if (id === 801) return { label, icon: 'few-clouds', mood: 'cloud' };
    if (id === 802) return { label, icon: 'partly-cloudy', mood: 'cloud' };
    return { label, icon: 'cloudy', mood: 'cloud' }; // 803, 804
  }
};

