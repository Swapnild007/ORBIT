# Eagle Eye

Standalone Android client and remote intelligence backend based on Ryan-Milton/Eagle-Eye.

## Architecture

- Android: Capacitor + React + Mapbox
- Backend: Bun, deployed separately from SAARTHI
- Backend hosting target: Render
- Android does not run Bun, Docker, a database, or a local backend.
- Production API is supplied through `VITE_EAGLE_EYE_API_URL`.

## Android build

```bash
npm install
npx cap add android
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Backend

Render configuration is provided in `render.yaml`.

Required backend secrets depend on the enabled data sources, including AIS and OpenSky credentials.

## License

See the upstream Eagle Eye LICENSE.
