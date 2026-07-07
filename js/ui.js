/**
 * ui.js
 * -----------------------------------------------------------------------
 * Everything that touches the DOM lives here. WeatherUI knows how to
 * render each screen state (loading / error / data) but has no idea
 * how to fetch anything - app.js wires it to WeatherService.
 * -----------------------------------------------------------------------
 */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

class WeatherUI {
  constructor(storageService) {
    this.storage = storageService;
    this.currentUnit = storageService.getUnit();
    this.lastWeatherData = null; // kept so unit toggle can re-render without refetching

    this.el = {
      root: document.documentElement,
      searchInput: document.getElementById('searchInput'),
      suggestions: document.getElementById('suggestions'),
      currentWeather: document.getElementById('currentWeather'),
      forecast: document.getElementById('forecast'),
      favorites: document.getElementById('favorites'),
      unitToggle: document.getElementById('unitToggle'),
      locationBtn: document.getElementById('locationBtn'),
      shareBtn: document.getElementById('shareBtn'),
      themeToggle: document.getElementById('themeToggle')
    };

    this._syncUnitToggleLabel();
  }

  // ---------------------------------------------------------------- units
  convert(tempC) {
    return this.currentUnit === 'celsius'
      ? Math.round(tempC)
      : Math.round((tempC * 9) / 5 + 32);
  }

  unitSuffix() {
    return this.currentUnit === 'celsius' ? '°C' : '°F';
  }

  toggleUnit() {
    this.currentUnit = this.currentUnit === 'celsius' ? 'fahrenheit' : 'celsius';
    this.storage.setUnit(this.currentUnit);
    this._syncUnitToggleLabel();
    // Re-render from cached data - no need to refetch just to change units.
    if (this.lastWeatherData) {
      this.displayCurrentWeather(this.lastWeatherData, { skipStore: true });
      this.displayForecast(this.lastWeatherData, { skipStore: true });
    }
  }

  _syncUnitToggleLabel() {
    if (!this.el.unitToggle) return;
    this.el.unitToggle.textContent = this.currentUnit === 'celsius' ? '°C' : '°F';
    this.el.unitToggle.setAttribute('aria-label', `Switch to ${this.currentUnit === 'celsius' ? 'Fahrenheit' : 'Celsius'}`);
  }

  // ------------------------------------------------------------ loading
  showLoading() {
    this.el.currentWeather.innerHTML = `
      <div class="skeleton-card" aria-live="polite" aria-busy="true">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-temp"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
      </div>`;
    this.el.forecast.innerHTML = '';
  }

  // -------------------------------------------------------------- error
  showError(message) {
    this.el.currentWeather.innerHTML = `
      <div class="error-card" role="alert">
        <div class="error-icon">⚠</div>
        <p>${this._escape(message)}</p>
        <button class="btn-retry" id="retryBtn" type="button">Try again</button>
      </div>`;
    this.el.forecast.innerHTML = '';
  }

  // ------------------------------------------------------- current card
  displayCurrentWeather(weatherData, opts = {}) {
    this.lastWeatherData = weatherData;
    const { current, city, timezoneOffsetSeconds } = weatherData;
    const temp = this.convert(current.tempC);
    const feels = this.convert(current.feelsLikeC);
    const isFav = this.storage.isFavorite(this._cityId(city));

    this.el.root.dataset.mood = current.mood;
    this.el.root.dataset.timeOfDay = current.isDay ? 'day' : 'night';

    const locationLabel = [city.name, city.admin1, city.country].filter(Boolean).join(', ');
    const localTime = this._localTimeLabel(timezoneOffsetSeconds);

    this.el.currentWeather.innerHTML = `
      <div class="weather-card">
        <div class="weather-card__header">
          <div>
            <h2>${this._escape(locationLabel)}</h2>
            <p class="local-time">${localTime}</p>
          </div>
          <button class="btn-favorite ${isFav ? 'is-active' : ''}" id="favoriteBtn" type="button"
                  aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
            ${isFav ? '★' : '☆'}
          </button>
        </div>

        <div class="weather-card__main">
          ${this._gaugeSvg(temp, current.icon)}
          <div class="temp-block">
            <span class="temperature">${temp}<span class="unit">${this.unitSuffix()}</span></span>
            <span class="condition">${this._escape(current.label)}</span>
          </div>
        </div>

        <dl class="weather-details">
          <div class="detail"><dt>Feels like</dt><dd>${feels}${this.unitSuffix()}</dd></div>
          <div class="detail"><dt>Humidity</dt><dd>${current.humidity}%</dd></div>
          <div class="detail"><dt>Wind</dt><dd>${current.windSpeed} km/h</dd></div>
          <div class="detail"><dt>Pressure</dt><dd>${current.pressure} hPa</dd></div>
        </dl>
      </div>`;
  }

  // ------------------------------------------------------------ forecast
  displayForecast(weatherData) {
    const rows = weatherData.forecast.map(day => {
      const date = new Date(`${day.date}T00:00:00`);
      const dayName = DAY_NAMES[date.getDay()];
      return `
        <div class="forecast-day" title="${this._escape(day.label)}">
          <span class="day-name">${dayName}</span>
          <span class="forecast-icon icon-${day.icon}" aria-hidden="true"></span>
          <span class="temps">
            <span class="temp-max">${this.convert(day.maxC)}°</span>
            <span class="temp-min">${this.convert(day.minC)}°</span>
          </span>
        </div>`;
    }).join('');

    this.el.forecast.innerHTML = `<div class="forecast-container">${rows}</div>`;
  }

  // ------------------------------------------------------------ gauge
  _gaugeSvg(temp, icon) {
    // A simple radial dial: maps -20..45C onto a 270 degree arc.
    const min = -20, max = 45;
    const clamped = Math.max(min, Math.min(max, temp));
    const pct = (clamped - min) / (max - min);
    const circumference = 2 * Math.PI * 52 * 0.75; // 270 degrees of the circle
    const offset = circumference * (1 - pct);

    return `
      <div class="gauge">
        <svg viewBox="0 0 120 120" class="gauge-svg" aria-hidden="true">
          <circle class="gauge-track" cx="60" cy="60" r="52"
                   stroke-dasharray="${circumference} 999"
                   transform="rotate(135 60 60)"/>
          <circle class="gauge-fill" cx="60" cy="60" r="52"
                   stroke-dasharray="${circumference} 999"
                   stroke-dashoffset="${offset}"
                   transform="rotate(135 60 60)"/>
        </svg>
        <span class="gauge-icon icon-${icon}" aria-hidden="true"></span>
      </div>`;
  }

  // ----------------------------------------------------------- favorites
  renderFavorites(onSelect) {
    const favorites = this.storage.getFavorites();
    if (!this.el.favorites) return;

    if (favorites.length === 0) {
      this.el.favorites.innerHTML = `<p class="favorites-empty">Star a city to pin it here for quick access.</p>`;
      return;
    }

    this.el.favorites.innerHTML = favorites.map(c => `
      <button class="chip" data-city-id="${this._escape(c.id)}" type="button">
        ${this._escape(c.name)}${c.country ? ', ' + this._escape(c.country) : ''}
      </button>`).join('');

    this.el.favorites.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const city = favorites.find(c => c.id === btn.dataset.cityId);
        if (city) onSelect(city);
      });
    });
  }

  // --------------------------------------------------------- suggestions
  renderSuggestions(cities, onSelect) {
    if (!cities.length) {
      this.el.suggestions.innerHTML = '';
      this.el.suggestions.hidden = true;
      return;
    }

    this.el.suggestions.hidden = false;
    this.el.suggestions.innerHTML = cities.map((c, i) => `
      <li role="option" data-index="${i}">
        <span class="suggestion-name">${this._escape(c.name)}</span>
        <span class="suggestion-meta">${this._escape([c.admin1, c.country].filter(Boolean).join(', '))}</span>
      </li>`).join('');

    this.el.suggestions.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => onSelect(cities[Number(li.dataset.index)]));
    });
  }

  clearSuggestions() {
    this.el.suggestions.innerHTML = '';
    this.el.suggestions.hidden = true;
  }

  // ------------------------------------------------------------- misc
  setFavoriteButtonState(isFav) {
    const btn = document.getElementById('favoriteBtn');
    if (!btn) return;
    btn.classList.toggle('is-active', isFav);
    btn.textContent = isFav ? '★' : '☆';
  }

  _cityId(city) {
    return city.id || `${city.name}_${city.country}`;
  }

  _localTimeLabel(timezoneOffsetSeconds) {
    if (timezoneOffsetSeconds == null) return '';
    try {
      const now = new Date();
      const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const local = new Date(utcMs + timezoneOffsetSeconds * 1000);

      const weekday = DAY_NAMES[local.getDay()];
      const hours24 = local.getHours();
      const minutes = String(local.getMinutes()).padStart(2, '0');
      const period = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = ((hours24 + 11) % 12) + 1;

      return `${weekday} ${hours12}:${minutes} ${period}`;
    } catch {
      return '';
    }
  }

  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }
}
