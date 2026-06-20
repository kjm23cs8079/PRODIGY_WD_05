# Skycast — Weather App
### Web Development Project · HTML / CSS / JavaScript

---

## Overview

A fully featured, real-time weather application built with **pure HTML, CSS,
and JavaScript** — no frameworks, no build tools, no API key required.

Weather data is fetched live from **Open-Meteo** (a free, open-source weather
API) and location names are resolved via **Nominatim / OpenStreetMap**
(also completely free).

---

## Project Structure

```
weather-project/
├── index.html        ← Page structure, all sections & semantic markup
├── css/
│   └── style.css     ← All styles, theming, animations, responsive layout
├── js/
│   └── weather.js    ← All logic: API calls, rendering, interactivity
└── README.md         ← This file
```

---

## Features

### Search & Location
| Feature | Detail |
|---|---|
| **City search** | Type any city name and get live autocomplete suggestions via Nominatim geocoding |
| **GPS location** | Click the ⊙ button to use your device's GPS and auto-detect your city |
| **Keyboard support** | Press Enter to search; Escape closes autocomplete |

### Current Conditions
| Data point | Source field |
|---|---|
| Temperature | `current.temperature_2m` |
| Feels Like | `current.apparent_temperature` |
| Humidity | `current.relative_humidity_2m` |
| Wind speed + direction | `current.wind_speed_10m` + `wind_direction_10m` |
| Visibility | `current.visibility` |
| Pressure | `current.surface_pressure` |
| Cloud cover | `current.cloud_cover` |
| Dew point | `current.dew_point_2m` |
| UV index | `current.uv_index` |

### Forecasts
- **7-day forecast grid** — high/low temperatures, weather icon, precipitation probability
- **24-hour hourly strip** — scrollable, temperature + precipitation per hour

### Visual & UX
- **Dynamic sky background** — gradient shifts to match the weather condition (clear, cloudy, rain, snow, thunder, fog, night)
- **Animated ambient canvas** — floating stars, rain streaks, snowflakes, or fog drifts based on live conditions
- **Floating weather icon** — gently animated via CSS keyframes
- **Animated sunrise/sunset arc** — SVG arc shows sun position for the current time of day
- **UV index colour bar** — green → yellow → orange → red → violet
- **°C / °F toggle** — recalculates all temperatures instantly without a new API call
- **Error handling** — clear, contextual messages for network failures or denied permissions
- **Responsive design** — works on desktop, tablet, and mobile

---

## APIs Used

| API | Purpose | Key required? |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Weather data (current + forecast) | ❌ None |
| [Nominatim](https://nominatim.openstreetmap.org) | Forward & reverse geocoding | ❌ None |

> **No sign-up, no API key, no cost.**

---

## How to Run

1. Unzip the project folder.
2. Open `index.html` in any modern browser.
3. Works directly from the file system — **no server required**.

> For the GPS feature, some browsers require the page to be served over
> `http://localhost` or `https://`. In that case, run a simple local server:
>
> ```bash
> # Python 3
> python -m http.server 8080
> # then open http://localhost:8080
> ```

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| Core weather display | ✅ | ✅ | ✅ | ✅ |
| CSS backdrop-filter | ✅ 76+ | ✅ 103+ | ✅ 9+ | ✅ 79+ |
| Geolocation API | ✅ | ✅ | ✅ | ✅ |
| Canvas particles | ✅ | ✅ | ✅ | ✅ |

---

## Code Architecture

### `index.html`
- Semantic HTML5 with ARIA roles (`role="list"`, `aria-label`, `aria-live`)
- Three view states: empty, loading, dashboard — toggled via the `hidden` attribute
- Single `<canvas>` for ambient background particles

### `css/style.css`
- **CSS custom properties** (`--sky-a`, `--sky-b`, `--accent`) drive the entire
  colour system; JavaScript adds a weather class to `<body>` to switch palettes
- **Glassmorphism cards** using `backdrop-filter: blur()` and semi-transparent
  backgrounds
- **No media query clutter** — a minimal set of two breakpoints (640px, 380px)
  handles all responsive behaviour

### `js/weather.js`
- **IIFE pattern** — all code is scoped, nothing pollutes `window`
- `decodeWMO()` — maps WMO weather codes (the international standard) to labels,
  emoji, and CSS theme classes
- `render()` — single function that writes all live data into the DOM
- `startAmbient()` — canvas particle system with five modes (star, rain, snow,
  cloud, fog) selected by weather condition
- Autocomplete debounced at 320ms to avoid excessive geocoding requests
- Unit conversion is purely in-memory — no extra network request when toggling °C/°F

---

*Skycast — built as a web development assignment.*
