/**
 * app.js
 * -----------------------------------------------------------------------
 * Bootstraps the app: wires WeatherService + WeatherUI together and
 * handles all user interaction (search, autocomplete, geolocation,
 * favorites, unit toggle, theme toggle, share).
 * -----------------------------------------------------------------------
 */

class App {
  constructor() {
    this.storage = new StorageService();
    this.weather = new WeatherService(this.storage);
    this.ui = new WeatherUI(this.storage);

    this.activeSuggestions = [];
    this.searchDebounceHandle = null;
    this.currentCity = null;

    this._bindEvents();
    this._applyManualThemeOverride();
    this._loadInitialCity();
    this.ui.renderFavorites(city => this.loadCity(city));
  }

  // ------------------------------------------------------------- events
  _bindEvents() {
    const { searchInput, unitToggle, locationBtn, shareBtn, themeToggle, currentWeather } = this.ui.el;

    searchInput.addEventListener('input', () => this._onSearchInput());
    searchInput.addEventListener('keydown', e => this._onSearchKeydown(e));
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) this.ui.clearSuggestions();
    });

    unitToggle.addEventListener('click', () => this.ui.toggleUnit());

    locationBtn.addEventListener('click', () => this._useMyLocation());

    shareBtn.addEventListener('click', () => this._shareWeather());

    themeToggle.addEventListener('click', () => this._toggleManualTheme());

    // Event delegation for buttons rendered dynamically inside currentWeather
    currentWeather.addEventListener('click', e => {
      if (e.target.id === 'favoriteBtn') this._toggleFavorite();
      if (e.target.id === 'retryBtn') this._retry();
    });
  }

  // -------------------------------------------------------------- search
  _onSearchInput() {
    const query = this.ui.el.searchInput.value.trim();
    clearTimeout(this.searchDebounceHandle);

    if (query.length < 2) {
      this.ui.clearSuggestions();
      return;
    }

    this.searchDebounceHandle = setTimeout(async () => {
      try {
        const cities = await this.weather.searchCities(query);
        this.activeSuggestions = cities;
        this.ui.renderSuggestions(cities, city => this._selectCity(city));
      } catch (err) {
        // Autocomplete failures should stay quiet - the user can still press Enter.
        console.warn(err.message);
      }
    }, CONFIG.SEARCH_DEBOUNCE_MS);
  }

  _onSearchKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.activeSuggestions.length > 0) {
        this._selectCity(this.activeSuggestions[0]);
      }
    }
  }

  _selectCity(city) {
    this.ui.el.searchInput.value = city.name;
    this.ui.clearSuggestions();
    this.loadCity(city);
  }

  // ---------------------------------------------------------- core load
  async loadCity(city) {
    this.currentCity = city;
    this.ui.showLoading();

    try {
      const weatherData = await this.weather.getWeather(city);
      this.ui.displayCurrentWeather(weatherData);
      this.ui.displayForecast(weatherData);
      this.storage.setLastCity(city);
      this._recomputeEffectiveTheme();
    } catch (err) {
      this.ui.showError(err.message);
    }
  }

  _retry() {
    if (this.currentCity) this.loadCity(this.currentCity);
  }

  async _loadInitialCity() {
    const last = this.storage.getLastCity();
    if (last) {
      this.ui.el.searchInput.value = last.name;
      return this.loadCity(last);
    }
    // Sensible default for a first-ever visit.
    const fallback = { id: 'london_gb', name: 'London', country: 'United Kingdom', admin1: 'England', latitude: 51.5072, longitude: -0.1276 };
    this.ui.el.searchInput.value = fallback.name;
    this.loadCity(fallback);
  }

  // -------------------------------------------------------- geolocation
  _useMyLocation() {
    if (!navigator.geolocation) {
      this.ui.showError('Location detection is not supported in this browser.');
      return;
    }

    this.ui.showLoading();
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const city = await this.weather.reverseGeocode(coords.latitude, coords.longitude);
        this.loadCity(city);
      },
      () => this.ui.showError('Location access was denied. Search for a city instead.'),
      { timeout: 8000 }
    );
  }

  // ------------------------------------------------------------ favorite
  _toggleFavorite() {
    if (!this.currentCity || !this.ui.lastWeatherData) return;
    const city = {
      id: this.ui._cityId(this.currentCity),
      name: this.ui.lastWeatherData.city.name,
      country: this.ui.lastWeatherData.city.country,
      admin1: this.ui.lastWeatherData.city.admin1,
      latitude: this.currentCity.latitude,
      longitude: this.currentCity.longitude
    };
    const isFav = this.storage.toggleFavorite(city);
    this.ui.setFavoriteButtonState(isFav);
    this.ui.renderFavorites(c => this.loadCity(c));
  }

  // --------------------------------------------------------------- share
  async _shareWeather() {
    if (!this.ui.lastWeatherData) return;
    const { city, current } = this.ui.lastWeatherData;
    const temp = this.ui.convert(current.tempC);
    const text = `${city.name}: ${temp}${this.ui.unitSuffix()} and ${current.label.toLowerCase()} right now.`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Weather update', text });
      } catch {
        /* user cancelled - nothing to do */
      }
    } else {
      await navigator.clipboard.writeText(text);
      this._flashShareButton();
    }
  }

  _flashShareButton() {
    const btn = this.ui.el.shareBtn;
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  }

  // ---------------------------------------------------------------- theme
  _toggleManualTheme() {
    const root = document.documentElement;
    const current = root.dataset.themeOverride;
    const next = current === 'dark' ? 'light' : current === 'light' ? 'auto' : 'dark';
    root.dataset.themeOverride = next;
    localStorage.setItem('weatherApp_theme', next);
    this.ui.el.themeToggle.textContent = { dark: '🌙', light: '☀️', auto: '🌓' }[next];
    this._recomputeEffectiveTheme();
  }

  _applyManualThemeOverride() {
    const saved = localStorage.getItem('weatherApp_theme') || 'auto';
    document.documentElement.dataset.themeOverride = saved;
    this.ui.el.themeToggle.textContent = { dark: '🌙', light: '☀️', auto: '🌓' }[saved];
  }

  /** Combines the manual override with the city's actual day/night state
   *  into a single data-effective-theme attribute that the CSS reads. */
  _recomputeEffectiveTheme() {
    const root = document.documentElement;
    const override = root.dataset.themeOverride || 'auto';
    let effective;
    if (override === 'dark') effective = 'night';
    else if (override === 'light') effective = 'day';
    else effective = root.dataset.timeOfDay === 'night' ? 'night' : 'day';
    root.dataset.effectiveTheme = effective;
  }
}

document.addEventListener('DOMContentLoaded', () => new App());
