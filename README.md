A fully featured, real-time weather application built with pure HTML, CSS,
and JavaScript — no frameworks, no build tools, no API key required.

Weather data is fetched live from Open-Meteo (a free, open-source weather
API) and location names are resolved via Nominatim / OpenStreetMap
(also completely free).
For GPS, serve locally with python -m http.server 8080.
Forecasts


7-day forecast grid — high/low temperatures, weather icon, precipitation probability
24-hour hourly strip — scrollable, temperature + precipitation per hour


Visual & UX


Dynamic sky background — gradient shifts to match the weather condition (clear, cloudy, rain, snow, thunder, fog, night)
Animated ambient canvas — floating stars, rain streaks, snowflakes, or fog drifts based on live conditions
Floating weather icon — gently animated via CSS keyframes
Animated sunrise/sunset arc — SVG arc shows sun position for the current time of day
UV index colour bar — green → yellow → orange → red → violet
°C / °F toggle — recalculates all temperatures instantly without a new API call
Error handling — clear, contextual messages for network failures or denied permissions
Responsive design — works on desktop, tablet, and mobile
