/**
 * weather.js — Skycast Weather App
 *
 * APIs used (both FREE, no API key):
 *  • Open-Meteo         https://open-meteo.com      — weather data
 *  • Nominatim          https://nominatim.openstreetmap.org — geocoding
 *
 * Features:
 *  1. Search by city name with autocomplete
 *  2. GPS "use my location" via Geolocation API
 *  3. Current conditions, feels-like, humidity, wind, pressure, visibility…
 *  4. Animated sunrise/sunset arc
 *  5. UV index bar
 *  6. 7-day forecast grid
 *  7. 24-hour scrollable strip
 *  8. °C / °F toggle
 *  9. Dynamic sky background & weather icon
 * 10. Ambient particle canvas
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────
     State
  ───────────────────────────────────────── */
  const state = {
    unit: 'C',          // 'C' or 'F'
    lastLat: null,
    lastLon: null,
    rawData: null,      // last API response
    cityName: '',
    country: '',
    timezone: '',
  };

  /* ─────────────────────────────────────────
     DOM references
  ───────────────────────────────────────── */
  const $ = id => document.getElementById(id);

  const dom = {
    body:            document.body,
    searchInput:     $('search-input'),
    searchBtn:       $('search-btn'),
    locateBtn:       $('locate-btn'),
    autoList:        $('autocomplete-list'),
    errorMsg:        $('error-msg'),
    loadingState:    $('loading-state'),
    emptyState:      $('empty-state'),
    dashboard:       $('weather-dashboard'),
    locName:         $('loc-name'),
    locCountry:      $('loc-country'),
    locTime:         $('loc-time'),
    weatherIcon:     $('weather-icon'),
    tempValue:       $('temp-value'),
    tempUnitLabel:   $('temp-unit-label'),
    conditionText:   $('condition-text'),
    feelsLike:       $('feels-like'),
    statHumidity:    $('stat-humidity'),
    statWind:        $('stat-wind'),
    statVisibility:  $('stat-visibility'),
    statPressure:    $('stat-pressure'),
    statClouds:      $('stat-clouds'),
    statDew:         $('stat-dew'),
    sunriseVal:      $('sunrise-val'),
    sunsetVal:       $('sunset-val'),
    arcFill:         $('arc-fill'),
    sunDot:          $('sun-dot'),
    uvBar:           $('uv-bar'),
    uvVal:           $('uv-val'),
    forecastGrid:    $('forecast-grid'),
    hourlyStrip:     $('hourly-strip'),
    btnC:            $('btn-celsius'),
    btnF:            $('btn-fahrenheit'),
    canvas:          $('ambient-canvas'),
  };

  /* ─────────────────────────────────────────
     WMO weather code → label + emoji
  ───────────────────────────────────────── */
  function decodeWMO (code, isDay = true) {
    const night = !isDay;
    const map = {
      0:  { label: 'Clear sky',         icon: night ? '🌙' : '☀️',  cls: night ? 'night' : 'clear' },
      1:  { label: 'Mainly clear',      icon: night ? '🌙' : '🌤️',  cls: night ? 'night' : 'clear' },
      2:  { label: 'Partly cloudy',     icon: night ? '☁️' : '⛅',  cls: 'clouds' },
      3:  { label: 'Overcast',          icon: '☁️',                  cls: 'clouds' },
      45: { label: 'Foggy',             icon: '🌫️',                  cls: 'fog'    },
      48: { label: 'Icy fog',           icon: '🌫️',                  cls: 'fog'    },
      51: { label: 'Light drizzle',     icon: '🌦️',                  cls: 'rain'   },
      53: { label: 'Drizzle',           icon: '🌧️',                  cls: 'rain'   },
      55: { label: 'Heavy drizzle',     icon: '🌧️',                  cls: 'rain'   },
      61: { label: 'Light rain',        icon: '🌦️',                  cls: 'rain'   },
      63: { label: 'Rain',              icon: '🌧️',                  cls: 'rain'   },
      65: { label: 'Heavy rain',        icon: '🌧️',                  cls: 'rain'   },
      71: { label: 'Light snow',        icon: '🌨️',                  cls: 'snow'   },
      73: { label: 'Snow',              icon: '❄️',                   cls: 'snow'   },
      75: { label: 'Heavy snow',        icon: '❄️',                   cls: 'snow'   },
      80: { label: 'Rain showers',      icon: '🌦️',                  cls: 'rain'   },
      81: { label: 'Rain showers',      icon: '🌧️',                  cls: 'rain'   },
      82: { label: 'Heavy showers',     icon: '🌧️',                  cls: 'rain'   },
      85: { label: 'Snow showers',      icon: '🌨️',                  cls: 'snow'   },
      86: { label: 'Heavy snow showers',icon: '❄️',                   cls: 'snow'   },
      95: { label: 'Thunderstorm',      icon: '⛈️',                   cls: 'thunder'},
      96: { label: 'Thunderstorm+hail', icon: '⛈️',                   cls: 'thunder'},
      99: { label: 'Thunderstorm+hail', icon: '⛈️',                   cls: 'thunder'},
    };
    return map[code] || { label: 'Unknown', icon: '🌡️', cls: 'clear' };
  }

  /* ─────────────────────────────────────────
     Temperature conversion
  ───────────────────────────────────────── */
  function c2f (c) { return (c * 9/5 + 32); }
  function fmt (c, unit) {
    const v = unit === 'F' ? c2f(c) : c;
    return Math.round(v);
  }

  /* ─────────────────────────────────────────
     Show / hide helpers
  ───────────────────────────────────────── */
  function setVisible (el, visible) {
    el.hidden = !visible;
  }

  function showError (msg) {
    dom.errorMsg.textContent = msg;
    setVisible(dom.errorMsg, true);
    setTimeout(() => setVisible(dom.errorMsg, false), 5000);
  }

  function hideError () { setVisible(dom.errorMsg, false); }

  function setLoading (on) {
    setVisible(dom.loadingState, on);
    setVisible(dom.emptyState,   false);
    if (on) setVisible(dom.dashboard, false);
  }

  /* ─────────────────────────────────────────
     GEOCODE  city → {lat, lon, name, country}
  ───────────────────────────────────────── */
  async function geocode (query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error('Geocoding failed');
    return res.json();
  }

  /* REVERSE geocode  lat/lon → name */
  async function reverseGeocode (lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error('Reverse geocoding failed');
    return res.json();
  }

  /* ─────────────────────────────────────────
     WEATHER  fetch from Open-Meteo
  ───────────────────────────────────────── */
  async function fetchWeather (lat, lon) {
    const params = new URLSearchParams({
      latitude:                 lat,
      longitude:                lon,
      current:                  'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,visibility,is_day,dew_point_2m,uv_index',
      hourly:                   'temperature_2m,weather_code,precipitation_probability',
      daily:                    'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max',
      timezone:                 'auto',
      forecast_days:            7,
      forecast_hours:           24,
    });
    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API request failed');
    return res.json();
  }

  /* ─────────────────────────────────────────
     RENDER  weather data → DOM
  ───────────────────────────────────────── */
  function render (data, unit) {
    const c    = data.current;
    const info = decodeWMO(c.weather_code, c.is_day === 1);

    /* Body theme class */
    dom.body.className = '';
    dom.body.classList.add(`weather-${info.cls}`);
    if (c.is_day === 0) dom.body.classList.add('weather-night');

    /* Location & time */
    dom.locName.textContent    = state.cityName;
    dom.locCountry.textContent = state.country;
    dom.locTime.textContent    = new Date().toLocaleString('en-US', {
      timeZone: data.timezone,
      weekday:  'long',
      hour:     '2-digit',
      minute:   '2-digit',
    });

    /* Icon */
    dom.weatherIcon.textContent = info.icon;

    /* Temperature */
    dom.tempValue.textContent    = fmt(c.temperature_2m, unit);
    dom.tempUnitLabel.textContent = `°${unit}`;

    /* Condition */
    dom.conditionText.textContent = info.label;
    dom.feelsLike.textContent     = `Feels like ${fmt(c.apparent_temperature, unit)}°${unit}`;

    /* Stats */
    dom.statHumidity.textContent   = `${c.relative_humidity_2m}%`;
    dom.statWind.textContent       = `${Math.round(c.wind_speed_10m)} km/h ${windDir(c.wind_direction_10m)}`;
    dom.statVisibility.textContent = c.visibility >= 1000
      ? `${(c.visibility / 1000).toFixed(1)} km`
      : `${c.visibility} m`;
    dom.statPressure.textContent   = `${Math.round(c.surface_pressure)} hPa`;
    dom.statClouds.textContent     = `${c.cloud_cover}%`;
    dom.statDew.textContent        = `${fmt(c.dew_point_2m, unit)}°${unit}`;

    /* Sun arc */
    renderSunArc(data.daily.sunrise[0], data.daily.sunset[0], data.timezone);

    /* UV */
    const uv = c.uv_index ?? 0;
    dom.uvVal.textContent    = uv.toFixed(1);
    dom.uvBar.style.width    = `${Math.min((uv / 11) * 100, 100)}%`;
    dom.uvBar.style.background = uv <= 2 ? '#4ecdc4'
                                : uv <= 5 ? '#f5e642'
                                : uv <= 7 ? '#f5a623'
                                : uv <= 9 ? '#ff6b6b'
                                : '#c300ff';

    /* 7-day forecast */
    renderForecast(data.daily, unit);

    /* Hourly */
    renderHourly(data.hourly, unit, data.timezone);

    /* Show dashboard */
    setVisible(dom.dashboard, true);

    /* Ambient canvas */
    startAmbient(info.cls, c.is_day === 1);
  }

  /* Wind direction degrees → compass abbreviation */
  function windDir (deg) {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round(deg / 45) % 8];
  }

  /* Sunrise / sunset arc animation */
  function renderSunArc (sunriseISO, sunsetISO, tz) {
    const toMins = isoStr => {
      const d = new Date(isoStr);
      return d.getHours() * 60 + d.getMinutes();
    };

    const fmt12 = isoStr => new Date(isoStr).toLocaleTimeString('en-US', {
      timeZone: tz, hour: '2-digit', minute: '2-digit',
    });

    dom.sunriseVal.textContent = fmt12(sunriseISO);
    dom.sunsetVal.textContent  = fmt12(sunsetISO);

    const rise   = toMins(sunriseISO);
    const set    = toMins(sunsetISO);
    const now    = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // Arc total path length ≈ 283 (half-circle of r=90)
    const arcLen = 283;
    const progress = Math.max(0, Math.min(1, (nowMin - rise) / (set - rise)));

    setTimeout(() => {
      dom.arcFill.style.strokeDashoffset = arcLen * (1 - progress);

      // Move sun dot along the arc
      const angle   = Math.PI * (1 - progress); // π → 0
      const cx      = 100 + 90 * Math.cos(angle);
      const cy      = 100 - 90 * Math.sin(angle);
      dom.sunDot.setAttribute('cx', cx);
      dom.sunDot.setAttribute('cy', cy);
    }, 100);
  }

  /* 7-day forecast */
  function renderForecast (daily, unit) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    dom.forecastGrid.innerHTML = '';

    daily.weather_code.forEach((code, i) => {
      const info  = decodeWMO(code, true);
      const date  = new Date(daily.time ? daily.time[i] : Date.now() + i * 86400000);
      const label = i === 0 ? 'Today' : days[date.getDay()];
      const precip = daily.precipitation_probability_max[i];

      const el = document.createElement('div');
      el.className = `forecast-day${i === 0 ? ' today' : ''}`;
      el.setAttribute('role', 'listitem');
      el.setAttribute('aria-label',
        `${label}: ${info.label}, High ${fmt(daily.temperature_2m_max[i], unit)}°, Low ${fmt(daily.temperature_2m_min[i], unit)}°`);

      el.innerHTML = `
        <span class="fc-day-label">${label}</span>
        <span class="fc-icon">${info.icon}</span>
        <span class="fc-hi">${fmt(daily.temperature_2m_max[i], unit)}°</span>
        <span class="fc-lo">${fmt(daily.temperature_2m_min[i], unit)}°</span>
        ${precip > 20 ? `<span class="fc-precip">💧 ${precip}%</span>` : ''}
      `;
      dom.forecastGrid.appendChild(el);
    });
  }

  /* 24-hour strip */
  function renderHourly (hourly, unit, tz) {
    dom.hourlyStrip.innerHTML = '';
    const nowHour = new Date().getHours();

    hourly.temperature_2m.forEach((temp, i) => {
      const date   = new Date();
      date.setHours(date.getHours() + i, 0, 0, 0);
      const hour   = date.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true });
      const info   = decodeWMO(hourly.weather_code[i], true);
      const precip = hourly.precipitation_probability[i] ?? 0;
      const isNow  = i === 0;

      const el = document.createElement('div');
      el.className = `hourly-item${isNow ? ' now' : ''}`;
      el.setAttribute('role', 'listitem');

      el.innerHTML = `
        <span class="hr-time">${isNow ? 'Now' : hour}</span>
        <span class="hr-icon">${info.icon}</span>
        <span class="hr-temp">${fmt(temp, unit)}°</span>
        ${precip > 20 ? `<span class="hr-precip">💧 ${precip}%</span>` : ''}
      `;
      dom.hourlyStrip.appendChild(el);
    });
  }

  /* ─────────────────────────────────────────
     AMBIENT CANVAS (particles)
  ───────────────────────────────────────── */
  let animFrame;

  function startAmbient (cls, isDay) {
    cancelAnimationFrame(animFrame);
    const canvas  = dom.canvas;
    const ctx     = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    // Particle config by weather type
    const configs = {
      clear:   { count: 60,  type: 'star',   speed: 0.1, size: 1.5, color: 'rgba(255,255,200,0.7)'  },
      clouds:  { count: 20,  type: 'cloud',  speed: 0.3, size: 4,   color: 'rgba(180,200,255,0.12)' },
      rain:    { count: 120, type: 'rain',   speed: 6,   size: 1,   color: 'rgba(130,180,255,0.5)'  },
      snow:    { count: 80,  type: 'snow',   speed: 1.2, size: 3,   color: 'rgba(220,235,255,0.7)'  },
      thunder: { count: 30,  type: 'rain',   speed: 8,   size: 1.5, color: 'rgba(150,170,220,0.6)'  },
      fog:     { count: 15,  type: 'fog',    speed: 0.2, size: 8,   color: 'rgba(180,200,230,0.06)' },
      night:   { count: 80,  type: 'star',   speed: 0.05,size: 1.2, color: 'rgba(220,230,255,0.6)'  },
    };

    const cfg = configs[isDay ? cls : 'night'];

    const particles = Array.from({ length: cfg.count }, () => spawnParticle(cfg, canvas));

    function tick () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        updateParticle(p, cfg, canvas);
        drawParticle(ctx, p, cfg);
      });
      animFrame = requestAnimationFrame(tick);
    }
    tick();
  }

  function spawnParticle (cfg, canvas) {
    return {
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      size:  cfg.size * (0.5 + Math.random()),
      speed: cfg.speed * (0.8 + Math.random() * 0.4),
      alpha: 0.3 + Math.random() * 0.7,
      angle: Math.random() * Math.PI * 2,
      swing: (Math.random() - 0.5) * 0.5,
    };
  }

  function updateParticle (p, cfg, canvas) {
    switch (cfg.type) {
      case 'star':
        p.alpha += Math.sin(Date.now() * 0.001 + p.x) * 0.005;
        p.alpha  = Math.max(0.1, Math.min(0.9, p.alpha));
        break;
      case 'rain':
        p.y += p.speed;
        p.x += p.speed * 0.15;
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
        break;
      case 'snow':
        p.y    += p.speed;
        p.x    += Math.sin(p.angle) * 0.5;
        p.angle += 0.02;
        if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
        break;
      case 'cloud':
        p.x += p.speed;
        if (p.x > canvas.width + 80) { p.x = -80; p.y = Math.random() * canvas.height * 0.5; }
        break;
      case 'fog':
        p.x    += Math.cos(p.angle) * p.speed;
        p.y    += Math.sin(p.angle) * p.speed * 0.3;
        p.angle += 0.002;
        if (p.x < 0 || p.x > canvas.width) p.angle = Math.PI - p.angle;
        break;
    }
  }

  function drawParticle (ctx, p, cfg) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = cfg.color;

    switch (cfg.type) {
      case 'star':
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'rain':
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth   = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 1, p.y + p.size * 5);
        ctx.stroke();
        break;
      case 'snow':
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'cloud':
      case 'fog':
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 10, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  window.addEventListener('resize', () => {
    dom.canvas.width  = window.innerWidth;
    dom.canvas.height = window.innerHeight;
  });

  /* ─────────────────────────────────────────
     LOAD weather for coordinates
  ───────────────────────────────────────── */
  async function loadWeather (lat, lon, cityName, country) {
    hideError();
    setLoading(true);
    state.lastLat  = lat;
    state.lastLon  = lon;
    state.cityName = cityName;
    state.country  = country;

    try {
      const data = await fetchWeather(lat, lon);
      state.rawData = data;
      render(data, state.unit);
    } catch (err) {
      console.error(err);
      showError('Could not fetch weather data. Please try again.');
      setVisible(dom.emptyState, true);
    } finally {
      setLoading(false);
    }
  }

  /* ─────────────────────────────────────────
     SEARCH  with autocomplete
  ───────────────────────────────────────── */
  let acTimeout;

  dom.searchInput.addEventListener('input', () => {
    clearTimeout(acTimeout);
    const q = dom.searchInput.value.trim();
    if (q.length < 2) { closeAutocomplete(); return; }
    acTimeout = setTimeout(() => fetchAutocomplete(q), 320);
  });

  async function fetchAutocomplete (q) {
    try {
      const results = await geocode(q);
      renderAutocomplete(results);
    } catch (_) {}
  }

  function renderAutocomplete (results) {
    dom.autoList.innerHTML = '';
    if (!results.length) { closeAutocomplete(); return; }

    results.forEach(r => {
      const city    = r.address?.city || r.address?.town || r.address?.village || r.name;
      const country = r.address?.country || '';
      const state_  = r.address?.state || '';

      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.innerHTML = `<span class="city-name">${city}</span><span class="city-meta">${state_ ? state_ + ', ' : ''}${country}</span>`;
      li.addEventListener('mousedown', e => {
        e.preventDefault();
        dom.searchInput.value = city;
        closeAutocomplete();
        loadWeather(parseFloat(r.lat), parseFloat(r.lon), city, country);
      });
      dom.autoList.appendChild(li);
    });

    dom.autoList.hidden = false;
  }

  function closeAutocomplete () { dom.autoList.hidden = true; dom.autoList.innerHTML = ''; }

  dom.searchInput.addEventListener('blur', () => setTimeout(closeAutocomplete, 200));

  dom.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doSearch(); }
    if (e.key === 'Escape') closeAutocomplete();
  });

  dom.searchBtn.addEventListener('click', doSearch);

  async function doSearch () {
    const q = dom.searchInput.value.trim();
    if (!q) return;
    closeAutocomplete();
    setLoading(true);
    try {
      const results = await geocode(q);
      if (!results.length) { showError(`No results found for "${q}".`); setLoading(false); setVisible(dom.emptyState, true); return; }
      const r       = results[0];
      const city    = r.address?.city || r.address?.town || r.address?.village || r.name;
      const country = r.address?.country || '';
      await loadWeather(parseFloat(r.lat), parseFloat(r.lon), city, country);
    } catch (err) {
      console.error(err);
      showError('Geocoding failed. Check your connection and try again.');
      setLoading(false);
      setVisible(dom.emptyState, true);
    }
  }

  /* ─────────────────────────────────────────
     GPS  use current location
  ───────────────────────────────────────── */
  dom.locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) { showError('Geolocation is not supported by your browser.'); return; }
    hideError();
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const geo     = await reverseGeocode(lat, lon);
          const city    = geo.address?.city || geo.address?.town || geo.address?.village || geo.name || 'Current Location';
          const country = geo.address?.country || '';
          dom.searchInput.value = city;
          await loadWeather(lat, lon, city, country);
        } catch (_) {
          await loadWeather(lat, lon, 'Current Location', '');
        }
      },
      err => {
        setLoading(false);
        setVisible(dom.emptyState, true);
        const msgs = {
          1: 'Location access denied. Please allow location access in your browser settings.',
          2: 'Location unavailable. Try searching by city name.',
          3: 'Location request timed out.',
        };
        showError(msgs[err.code] || 'Could not get your location.');
      },
      { timeout: 10000 }
    );
  });

  /* ─────────────────────────────────────────
     °C / °F TOGGLE
  ───────────────────────────────────────── */
  dom.btnC.addEventListener('click', () => setUnit('C'));
  dom.btnF.addEventListener('click', () => setUnit('F'));

  function setUnit (unit) {
    state.unit = unit;
    dom.btnC.classList.toggle('active', unit === 'C');
    dom.btnF.classList.toggle('active', unit === 'F');
    dom.btnC.setAttribute('aria-pressed', String(unit === 'C'));
    dom.btnF.setAttribute('aria-pressed', String(unit === 'F'));
    if (state.rawData) render(state.rawData, unit);
  }

  /* ─────────────────────────────────────────
     INIT — try to load a default city
  ───────────────────────────────────────── */
  function init () {
    // Show empty state by default
    setVisible(dom.emptyState,   true);
    setVisible(dom.loadingState, false);
    setVisible(dom.dashboard,    false);

    // Auto-detect if permission already granted
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') dom.locateBtn.click();
      });
    }
  }

  init();

})();
