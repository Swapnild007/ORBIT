# ORBIT UI specification — v0.1

Status: **Proposed baseline for design review**  
Scope: responsive web MVP, later packaged for Android.

## Experience definition

ORBIT should feel like a calm, capable personal workspace rather than a generic chatbot or a crowded analytics dashboard. The assistant is a primary destination, but not the whole product. Use one clear primary navigation system per viewport.

## Visual direction

- Light-first interface with a soft neutral canvas, crisp white/surface cards, dark ink text, and a restrained indigo-blue accent.
- Optional dark theme can follow after the light theme is reviewed and implemented consistently.
- Subtle translucency may be used selectively for floating surfaces; do not apply glass effects to every panel or compromise contrast/readability.
- Clear typography hierarchy, generous spacing, restrained shadows, consistent radii, and purposeful iconography.
- Avoid excessive gradients, glowing neon, decorative charts, nested cards, and duplicate navigation bars.
- Use real labels and meaningful empty states; avoid placeholder-only controls.

## Responsive navigation

### Compact phone viewport
- Top app bar: ORBIT mark/name, page title or context, one contextual action.
- Bottom navigation: Home, Assistant, Projects, Memory, with Library and Settings accessible from a clearly labeled “More” destination or profile/settings entry. Do not show a second bottom menu.
- Content uses a single column, safe-area-aware padding, comfortable touch targets, and sticky actions only where useful.
- Dialogs become bottom sheets when appropriate; forms remain scrollable and keyboard-safe.

### Tablet / wide viewport
- Persistent left navigation rail or sidebar with destinations and a clearly visible active state.
- Main content gets a constrained readable width; use two-pane layouts for list/detail where they improve scanning.
- Do not stretch forms and reading content across the entire screen.
- Reflow content instead of simply scaling the phone layout.

## Screen requirements

### Home
- Greeting and concise date/context.
- “Today” focus section with up to three suggested priorities, clearly labeled as suggestions.
- Upcoming commitments and active projects.
- One primary action: add a task or capture a note.
- No dense KPI dashboard or decorative data visualizations in MVP.

### Assistant
- Conversation list/history and clear new-chat action.
- Message composer pinned above the bottom safe area.
- Assistant responses can show source chips/links and uncertainty labels.
- Proposed actions appear as preview cards with explicit Confirm and Cancel controls.
- Demo responses must be labeled as examples until connected to real retrieval.

### Projects
- Search/filter and project list with concise status.
- Project detail contains goal, milestones, tasks, notes and activity.
- Create/edit/delete flows with validation and undo/confirmation for destructive actions.
- Use progressive disclosure; do not display all project details on the overview page.

### Memory
- Searchable list of notes/memory records.
- Each record shows type, source, date and review state.
- Users can edit, confirm, dismiss, or delete a proposed memory.
- Graph visualization is deferred until relationships and interaction needs are proven.

### Library
- Document list, search, file type, date, and associated project.
- Upload state, unsupported-file state, and clear privacy messaging.
- Do not imply file contents have been indexed unless processing actually completed.

### Settings
- Profile and appearance.
- Data export and deletion.
- AI provider/model and data-sharing explanation.
- Connected services and permission controls.
- Privacy and security controls should be discoverable, not buried.

## Interaction and accessibility rules

- Every visible control has a working action or is visibly disabled with an explanation.
- Consistent focus, hover, pressed, selected, loading, success, and error states.
- Keyboard navigation and visible focus on web; semantic labels for assistive technologies.
- Meet WCAG 2.2 AA contrast targets where applicable; do not rely on color alone.
- Respect reduced-motion preferences and avoid essential information conveyed only through animation.
- Test at narrow phone width, common Android viewport sizes, tablet, and desktop; include text scaling and keyboard-open states.
- Support browser back/forward and preserve expected navigation state.

## Design freeze / change control

Before expanding feature scope, review and approve:
1. Navigation map and information architecture.
2. Home, Assistant, Projects, Memory, and Settings screen layouts.
3. Color, typography, spacing, radii, and icon rules.
4. Phone and wide-screen responsive behavior.
5. Interaction states and acceptance checklist.

After approval, treat this specification as the baseline. Any change should be recorded as a deliberate change request with reason, affected screens, and regression checks. Do not make visual changes opportunistically while implementing unrelated features.

## First review gate

Approve or revise this v0.1 direction before building the full UI. Then implement the whole shell and all MVP screens as one coherent pass, followed by a screenshot-based QA pass at phone and desktop sizes.
