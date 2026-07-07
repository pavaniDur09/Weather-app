# Skyward — Weather Application

A weather dashboard built for the Week 4 project (Frontend Integration & Final Project). It fetches live conditions and a 5-day forecast from **OpenWeatherMap**, with a few extras on top of the base brief.

## Live features

**From the brief:**
- Fetches current weather + forecast from OpenWeatherMap
- City search with autocomplete (OpenWeatherMap Geocoding API)
- Temperature unit conversion (°C / °F), applied to *every* displayed number, not just a label
- Fully responsive layout (phone → tablet → desktop)
- Error handling for failed requests, with a retry button
- Data caching in `localStorage` (10-minute TTL) so repeat searches don't re-hit the API
- Loading state (skeleton placeholder, not just a spinner)

**Small extras added for polish:**
- **"Use my location"** button using the Geolocation API + reverse geocoding
- **Favorite cities** — star a city to pin it as a quick-access chip, persisted in `localStorage`
- **Radial temperature gauge** — the current temperature is shown on an animated instrument-style dial rather than a plain number
- **Day/night + condition-aware theming** — the palette's accent color shifts with the weather (sun/cloud/rain/snow/storm/fog), and there's a manual dark/light/auto toggle in the header
- **Share button** — uses the native Web Share API on supported devices, falls back to copy-to-clipboard
- **True daily min/max forecast** — rather than just grabbing one 3-hour reading per day, the app aggregates all of OpenWeatherMap's 3-hour steps into real daily highs/lows

## Setting up OpenWeatherMap

### 1. Get a free API key
1. Go to **https://home.openweathermap.org/users/sign_up** and create a free account.
2. Once logged in, go to **My API keys** (in your account menu).
3. Copy the default key that's generated (or click "Generate" for a new one).

> ⚠️ **New keys take 10 minutes–2 hours to activate.** If you get a `401 Unauthorized` error right after signing up, that's normal — just wait a bit and try again.

This project uses two free-tier OpenWeatherMap APIs:
- **Current Weather Data** (`/data/2.5/weather`)
- **5 Day / 3 Hour Forecast** (`/data/2.5/forecast`)
- **Geocoding API** (`/geo/1.0/direct` and `/geo/1.0/reverse`) for search + "use my location"

All of these are included in OpenWeatherMap's free plan (1,000 calls/day at time of writing) — no credit card required. Double check current limits on their pricing page, since free-tier terms can change.

### 2. Add your key to the project

Browsers can't read a `.env` file directly since this project has no build step (no webpack/vite/etc.), so the key lives in a small JS file instead:

```bash
cd week4-weather-app
cp js/env.example.js js/env.js
```

Then open `js/env.js` and replace the placeholder:

```javascript
window.OWM_API_KEY = 'paste-your-real-key-here';
```

`js/env.js` is listed in `.gitignore`, so **it will never be committed to GitHub** — that's the whole reason it's split out from `config.js`. `.env.example` is kept in the repo purely as a reference/documentation file for the expected structure.

### 3. Run it
See "Running it" below. If you forget to add a key, the app will show a clear error message telling you where to add it, instead of failing silently.

## Project structure

```
week4-weather-app/
├── index.html
├── css/
│   ├── style.css          # design tokens, layout, the gauge
│   ├── weather-icons.css  # condition → glyph mapping
│   └── responsive.css     # breakpoints
├── js/
│   ├── env.js              # ⚠️ your real API key (gitignored, create this)
│   ├── env.example.js      # template for env.js
│   ├── config.js           # endpoints, cache duration, weather-code mapping
│   ├── storage.js          # localStorage wrapper (cache/favorites/prefs)
│   ├── weatherService.js   # API calls + response normalization
│   ├── ui.js                # all DOM rendering
│   └── app.js                # event wiring / orchestration
├── assets/
│   ├── icons/
│   └── images/
├── README.md
├── .env.example
└── .gitignore
```

## Running it

No build step. Either:

1. Open `index.html` directly in a browser, **or**
2. Serve it locally so geolocation/clipboard permissions behave consistently:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8080
   ```

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository (double check `js/env.js` is **not** included in your commit — `git status` should not list it, since it's gitignored).
2. Repo **Settings → Pages → Source**: select the `main` branch, root folder.
3. Your app will be live at `https://<username>.github.io/<repo-name>/`.

⚠️ **Important for public repos:** since this is a client-side-only app with no backend, your API key will be visible in the browser's network requests to anyone who inspects the live site — this is a known limitation of any purely-frontend API integration, not specific to this project. For a school project this is normal and expected. If you ever build something production-grade, you'd proxy the request through a small backend to hide the key instead.

## Notes on architecture

- `WeatherService` never touches the DOM; `WeatherUI` never calls `fetch`. `app.js` is the only file that knows about both, which keeps each piece independently testable.
- All API responses are normalized in `weatherService.js._normalize()` so the rest of the app only ever deals with one predictable shape.
- Temperatures are always stored/cached in Celsius and converted for display only, so toggling units never requires a re-fetch.
- The forecast endpoint returns 3-hour steps; `_groupForecastByDay()` aggregates those into real daily min/max rather than just sampling one reading per day.
