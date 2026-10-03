# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Eagle Eye is a geospatial intelligence dashboard — a single-page React app featuring an interactive 3D globe (Three.js), entity tracking panels, and a live activity feed. It is a front-end-only project with no backend; all data is static/mock.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Type-check with `tsc -b` then Vite production build
- `npm run lint` — ESLint across the project
- `npm run preview` — Preview the production build locally

No test framework is configured.

## Architecture

The app renders a fixed-position layout with four surrounding panels and a central 3D globe:

```
┌──────────────── TopBar ─────────────────┐
│ LeftPanel │     GlobeView     │ RightPanel│
│ (entities)│   (Three.js 3D)   │  (feed)   │
└──────────────── BottomBar ──────────────┘
```

**App.tsx** — Root component. Holds `activeView` (nav state), `selectedEntity`, and `sessionStart` timestamp. Selecting an entity in LeftPanel rotates the globe to focus on it.

**GlobeView** (`src/components/globe/GlobeView.tsx`) — The largest and most complex component. Manages an entire Three.js scene imperatively inside a single `useEffect`: renderer, camera, globe mesh with a procedural canvas texture (simplified continent outlines), entity node dots with pulse animations, arc lines with traveling particles, mouse-drag rotation, zoom, and a coordinate HUD. Layer visibility (grid/arcs/nodes/density) is toggled via `layerRefs`.

**Data flow** — All entity and feed data comes from `src/data/index.ts` (static arrays). The `useFeed` hook cycles through `FEED_TEMPLATES` on a randomized 5–9s interval to simulate a live feed. The `useClock` hook ticks every second for UTC time display and session elapsed timer.

**Panels** — `TopBar` has nav tabs and a live clock. `LeftPanel` has entity search/filter and a selectable entity list. `RightPanel` shows the activity feed via `useFeed`. `BottomBar` shows session metadata and a timeline scrubber.

## Key Conventions

- **Path alias**: `@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.json`)
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` plugin. Custom fonts (Barlow Condensed, Barlow, DM Mono) loaded from Google Fonts in `index.html`. The `cn()` utility (`clsx` + `tailwind-merge`) is in `src/lib/utils.ts`.
- **UI primitives**: `Badge` and `Pip` in `src/components/ui/` are small reusable status indicators used across panels.
- **Types**: All shared types live in `src/types/index.ts` — entity types, severity levels, nav views, filter tabs, layer IDs.
- **Coordinate math**: `latLonToVec3` in `src/lib/utils.ts` converts lat/lon to Three.js 3D coordinates on the globe sphere.
- **Color scheme**: Dark zinc background with orange as the primary accent color. Entity types have distinct colors: person=blue, vehicle=yellow, location=green, signal=orange.
