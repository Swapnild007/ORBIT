# ORBIT

**ORBIT is a mobile-first personal workspace with an integrated, user-controlled AI assistant.** It is an independent project and is not part of NorthStar.

## Product direction

Build and validate the web experience first, then package the same product for Android. ORBIT is an app-like digital environment, not a replacement mobile operating system: it will not require bootloader unlocking, rebooting, rooting, or replacing Android.

### Product principles
- Useful without AI: projects, tasks, notes, and search work independently.
- User-owned context: inspect, edit, export, and delete saved information.
- Source-grounded assistance: answers should link back to the notes or files used.
- Permission-first actions: show a preview and require confirmation before consequential changes.
- Mobile-first, responsive, accessible, and consistent across web and Android.

## Initial navigation
1. Home — daily overview and active work.
2. Assistant — contextual chat and source-linked answers.
3. Projects — projects, milestones, and tasks.
4. Memory — searchable notes and user-reviewed memories.
5. Library — files and saved references.
6. Settings — privacy, data controls, and integrations.

Use a compact bottom navigation on phone-sized screens. On wider screens, switch to a persistent side navigation and adaptive content panes. Do not duplicate primary navigation in multiple bars.

## MVP scope
- Responsive app shell and navigation
- Home overview using realistic sample data
- Create, edit, complete, and delete projects and tasks
- Notes and searchable memory records
- Assistant screen with clearly marked demo responses at first
- Settings page with privacy and data-control affordances
- Loading, empty, error, and offline states
- Accessibility, keyboard support, and touch target checks

Not in MVP: autonomous background agents, unrestricted device access, full OS replacement, complex graph visualization, multi-provider sync, or broad third-party integrations.

## Technology direction
- Next.js App Router + TypeScript for the web application.
- React and a documented design-token system for the UI.
- PostgreSQL for persistent account/workspace data when backend work begins.
- Keep AI orchestration behind a provider-neutral server interface; do not expose provider keys in the client.
- PWA manifest and service-worker capabilities for installable web experience.
- Evaluate Capacitor for Android packaging after the web app is stable and responsive. Native device features should be added through explicit, permissioned plugins.

## Definition of first milestone
A polished, responsive, navigable prototype with Home, Assistant, Projects, Memory, and Settings, using sample data and working local interactions. Review and approve the design system and key screen layouts before expanding scope.

## Research references
- Next.js PWA guide: https://nextjs.org/docs/app/guides/progressive-web-apps
- Next.js manifest convention: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
- Capacitor documentation: https://capacitorjs.com/docs
- Android adaptive layouts: https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout
- Android navigation patterns: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns
- W3C navigation accessibility: https://www.w3.org/WAI/curricula/designer-modules/navigation-design/

These are implementation and design references, not a claim that the product is already built or tested.
