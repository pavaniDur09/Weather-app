/**
 * weatherService.js
 * -----------------------------------------------------------------------
 * Talks to OpenWeatherMap's Geocoding, Current Weather, and 5-day/3-hour
 * Forecast APIs and normalizes their responses into a small, predictable
 * shape the UI can rely on. All results pass through StorageService for
 * localStorage caching.
 * -----------------------------------------------------------------------
 */

class WeatherService {
  constructor(storageService) {
    this.storage = storageService;
  }

  _requireKey() {
    if (!CONFIG.OWM_API_KEY || CONFIG.OWM_API_KEY.includes('YOUR_OPENWEATHERMAP')) {
      throw new Error(
        'Add your OpenWeatherMap API key to js/env.js to load weather data. See README.md for setup steps.'
      );
    }
  }

  /** City/place search for the autocomplete dropdown. */
  async searchCities(query) {
    if (!query || query.trim().length < 2) return [];
    this._requireKey();

    const cacheKey = `geo_${query.trim().toLowerCase()}`;
    const cached = this.storage.getCache(cacheKey);
    if (cached) return cached;

    const url = `${CONFIG.GEO_DIRECT_URL}?q=${encodeURIComponent(query)}&limit=${CONFIG.MAX_SUGGESTIONS}&appid=${CONFIG.OWM_API_KEY}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Geocoding error: ${response.status}`);

      const data = await response.json();
      const results = data.map(place => ({
        id: `${place.lat.toFixed(2)}_${place.lon.toFixed(2)}`,
        name: place.name,
        country: place.country || '',
        admin1: place.state || '',
        latitude: place.lat,
        longitude: place.lon
      }));

      this.storage.setCache(cacheKey, results);
      return results;
    } catch (err) {
      console.error('Error searching cities:', err);
      throw new Error('Could not search for that city. Check your connection and API key.');
    }
  }

  /** Reverse geocode lat/lng (used for "use my location") into a city-like object. */
  async reverseGeocode(latitude, longitude) {
    this._requireKey();

    const url = `${CONFIG.GEO_REVERSE_URL}?lat=${latitude}&lon=${longitude}&limit=1&appid=${CONFIG.OWM_API_KEY}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Reverse geocoding error: ${response.status}`);

      const data = await response.json();
      const place = data[0];

      return {
        id: `${latitude.toFixed(2)}_${longitude.toFixed(2)}`,
        name: place ? place.name : 'Current location',
        country: place ? place.country : '',
        admin1: place ? (place.state || '') : '',
        latitude,
        longitude
      };
    } catch (err) {
      console.error('Error reverse geocoding:', err);
      // Fall back to plain coordinates so weather can still load.
      return {
        id: `${latitude.toFixed(2)}_${longitude.toFixed(2)}`,
        name: 'Current location',
        country: '',
        admin1: '',
        latitude,
        longitude
      };
    }
  }

  /** Current conditions + 5-day/3-hour forecast, combined into one normalized object. */
  async getWeather(city) {
    this._requireKey();

    const cacheKey = `weather_${city.latitude.toFixed(2)}_${city.longitude.toFixed(2)}`;
    const cached = this.storage.getCache(cacheKey);
    if (cached) return cached;

    const currentUrl = `${CONFIG.WEATHER_URL}?lat=${city.latitude}&lon=${city.longitude}&units=metric&appid=${CONFIG.OWM_API_KEY}`;
    const forecastUrl = `${CONFIG.FORECAST_URL}?lat=${city.latitude}&lon=${city.longitude}&units=metric&appid=${CONFIG.OWM_API_KEY}`;

    try {
      const [currentRes, forecastRes] = await Promise.all([
        fetch(currentUrl),
        fetch(forecastUrl)
      ]);

      if (!currentRes.ok) throw new Error(`API Error: ${currentRes.status}`);
      if (!forecastRes.ok) throw new Error(`API Error: ${forecastRes.status}`);

      const currentData = await currentRes.json();
      const forecastData = await forecastRes.json();

      const normalized = this._normalize(currentData, forecastData, city);
      this.storage.setCache(cacheKey, normalized);
      return normalized;
    } catch (err) {
      console.error('Error fetching weather:', err);
      if (err.message.includes('401')) {
        throw new Error('Invalid API key. Double check js/env.js against your OpenWeatherMap dashboard.');
      }
      throw new Error('Could not load weather data. Check your connection and try again.');
    }
  }

  /** Reshape the raw OpenWeatherMap payloads into what the UI expects. */
  _normalize(currentData, forecastData, city) {
    const cw = currentData.weather[0];
    const currentInfo = CONFIG.weatherCodeInfo(cw.id, cw.description);

    const current = {
      tempC: Math.round(currentData.main.temp),
      feelsLikeC: Math.round(currentData.main.feels_like),
      humidity: currentData.main.humidity,
      windSpeed: Math.round(currentData.wind.speed * 3.6), // m/s -> km/h
      pressure: currentData.main.pressure,
      isDay: cw.icon.endsWith('d'),
      ...currentInfo
    };

    const forecast = this._groupForecastByDay(forecastData.list).slice(0, 5).map(day => {
      const info = CONFIG.weatherCodeInfo(day.weather.id, day.weather.description);
      return {
        date: day.date,
        maxC: Math.round(day.maxC),
        minC: Math.round(day.minC),
        ...info
      };
    });

    return {
      city: {
        name: city.name,
        country: city.country,
        admin1: city.admin1
      },
      timezoneOffsetSeconds: currentData.timezone, // seconds offset from UTC
      current,
      forecast
    };
  }

  /**
   * OpenWeatherMap's forecast endpoint returns 3-hour steps for 5 days
   * (40 entries). Group them into calendar days, taking the true min/max
   * across that day's entries and using the entry closest to midday as
   * the representative condition/icon for the day.
   */
  _groupForecastByDay(list) {
    const days = new Map();

    list.forEach(entry => {
      const date = entry.dt_txt.split(' ')[0]; // "YYYY-MM-DD"
      const hour = Number(entry.dt_txt.split(' ')[1].split(':')[0]);

      if (!days.has(date)) {
        days.set(date, {
          date,
          maxC: entry.main.temp_max,
          minC: entry.main.temp_min,
          weather: entry.weather[0],
          closestToMiddayDiff: Math.abs(hour - 12)
        });
      } else {
        const day = days.get(date);
        day.maxC = Math.max(day.maxC, entry.main.temp_max);
        day.minC = Math.min(day.minC, entry.main.temp_min);

        const diff = Math.abs(hour - 12);
        if (diff < day.closestToMiddayDiff) {
          day.weather = entry.weather[0];
          day.closestToMiddayDiff = diff;
        }
      }
    });

    // Drop today (index 0) so "forecast" means "next 5 days", matching the UI heading.
    return Array.from(days.values()).slice(1);
  }
}
