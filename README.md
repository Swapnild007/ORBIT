# Eagle Eye

Real-time geospatial intelligence dashboard for multi-domain situational awareness.

## Overview

Eagle Eye is a full-stack web application that fuses 15+ live data sources onto an interactive Mapbox 3D globe. It provides real-time tracking and visualization across maritime, aviation, satellite, weather, news, armed conflict, cyber threat, and open-source intelligence (OSINT) domains — all in a single unified interface.

The frontend is built with React and Mapbox GL JS, while a Bun-based backend server handles data aggregation, API proxying, and WebSocket streaming. Zustand stores manage live state across all domains, and a rule-based alert engine monitors incoming data for user-defined triggers.

## Features

**Multi-Domain Entity Tracking**
- Satellites — Celestrak TLE data with SGP4 orbital propagation, ground tracks, and sensor footprints
- Maritime vessels — Live AIS positions via AISStream.io WebSocket, dark vessel anomaly detection
- Aircraft — OpenSky Network + ADS-B Exchange flight tracking with HexDB metadata enrichment
- Weather events — USGS earthquakes, NOAA storms, EO-NET volcanoes, severe weather alerts
- Armed conflicts — ACLED event data with fatality counts and actor information
- Cyber threats — AbuseIPDB IP reputation, IODA internet outage detection
- OSINT — Reddit, Mastodon, and Bluesky intelligence posts with automated geolocation
- News — GDELT, NewsData.io, Currents API, and RSS feeds (BBC, Al Jazeera, NYT) with geocoding
- Infrastructure — Submarine cable routes, power plants, landing points
- Additional domains — Ports, RF spectrum, webcams, economic indicators

**Map Tools**
- Visualization modes: standard, satellite, NVG (night vision), thermal, CRT
- Geofence drawing with alert triggers
- Distance and bearing measurement tool
- Quick-fly regional presets for 12 geopolitical hotspots
- Coordinate HUD and map screenshot export

**Alert System**
- Rule-based triggers: domain filter, severity threshold, keyword match, geofence, proximity
- Browser notifications and audio alerts
- Toast notifications with action links
- Persistent watchlist

**Analysis Views**
- Objects — Sortable entity table with CSV and GeoJSON export
- Graph — Force-directed proximity network visualization
- Signals — Data source health and connection status dashboard
- Reports — Charts and analytics by domain, type, severity, and time

**Timeline**
- 6-hour scrubber with drag interaction
- Replay mode with 1x–10x playback speed

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 5.9 |
| Mapping | Mapbox GL JS 3.19 |
| State | Zustand 5.0 |
| Styling | Tailwind CSS 4, Barlow + DM Mono fonts |
| Charts | Recharts 3.7 |
| Orbital Mechanics | satellite.js 6.0 |
| Backend | Bun (HTTP + WebSocket) |
| Bundler | Vite 6.4 |
| UI Primitives | Radix UI, Lucide React |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)

### Installation

```bash
git clone git@github.com:Ryan-Milton/Eagle-Eye.git
cd Eagle-Eye
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_MAPBOX_TOKEN=        # Required — Mapbox GL access token (mapbox.com)
AIS_API_KEY=              # AISStream.io — live maritime vessel tracking
OPENSKY_CLIENT_ID=        # OpenSky Network — flight tracking (opensky-network.org)
OPENSKY_CLIENT_SECRET=    # OpenSky Network OAuth2 secret
WINDY_WEBCAMS_KEY=        # Windy — global webcam feeds (api.windy.com)
ABUSEIPDB_KEY=            # AbuseIPDB — cyber threat IP reputation (abuseipdb.com)
EIA_KEY=                  # U.S. Energy Information Administration (eia.gov)
NEWSDATA_API_KEY=         # NewsData.io — news aggregation (optional)
CURRENTS_API_KEY=         # Currents API — news aggregation (optional)
ACLED_EMAIL=              # ACLED — armed conflict data (acleddata.com)
ACLED_PASSWORD=           # ACLED account password
ACLED_REFRESH_TOKEN=      # ACLED OAuth refresh token
```

Only `VITE_MAPBOX_TOKEN` is strictly required for the app to render. Other keys enable their respective data sources — the app will gracefully skip any source without a configured key.

### Development

```bash
npm run dev
```

This starts the Bun backend server on port 4000 and the Vite dev server with hot module replacement.

### Production

```bash
npm run build      # Type-check + Vite production build
npm run preview    # Preview the production build locally
```

### Linting

```bash
npm run lint
```

## DEVLOG

Development videos documenting the build process:

[![Eagle Eye v0.1.0](https://img.youtube.com/vi/ppjlLvWwugM/maxresdefault.jpg)](https://youtu.be/ppjlLvWwugM)

[![Eagle Eye v0.1.2](https://img.youtube.com/vi/XLDdwGFtr3s/maxresdefault.jpg)](https://youtu.be/XLDdwGFtr3s)

[![Eagle Eye v0.1.3](https://img.youtube.com/vi/HGyLamHBzgc/maxresdefault.jpg)](https://youtu.be/HGyLamHBzgc)

[![Eagle Eye v0.1.4](https://img.youtube.com/vi/Hyz0rFOXKhc/maxresdefault.jpg)](https://youtu.be/Hyz0rFOXKhc)

[![Eagle Eye v0.1.5](https://img.youtube.com/vi/Q3PZz9fZuyo/maxresdefault.jpg)](https://youtu.be/Q3PZz9fZuyo)

[![Eagle Eye v0.1.6](https://img.youtube.com/vi/dxP_Eezr2BM/maxresdefault.jpg)](https://youtu.be/dxP_Eezr2BM)
