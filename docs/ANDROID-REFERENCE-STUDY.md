# Android OS and Desktop-Shell Reference Study

Reviewed: 2026-09-28  
Project: ORBIT

## Executive finding

Yes. Open-source Android-based operating systems and desktop-shell projects already exist. ORBIT should not attempt to recreate an Android OS from scratch for the current phone. The closest references are:

- **Bliss OS** for a full Android-based operating system aimed at PC hardware.
- **Smart Dock** and **Taskbar** for launcher-style desktop experiences that run on top of Android.
- **Boringdroid** for how a desktop shell can be integrated into AOSP/SystemUI when deeper OS-level control is needed.
- **MagicDesk** for an advanced Android workstation combining native Android windows, files, terminals, and desktop sessions.

ORBIT's current web build is a visual/product prototype, not an Android launcher or OS. Keep the web-first milestone, but plan a native Android launcher/shell implementation if the target is to enter and exit an alternate environment from the phone's Home flow.

## Repository review

### 1. Bliss OS
Repository: https://github.com/BlissOS  
Project map: https://blissos.org/projects.html

**Type:** Android-based operating system distribution, mainly for x86 PC hardware.

**Relevant takeaways**
- A complete OS project requires platform manifests, frameworks, device/kernel support, build and installer infrastructure.
- Bliss separates the core OS from the desktop experience: Boringdroid provides SystemUI/freeform/taskbar work; Smart Dock is a separate launcher layer.
- This is a useful system architecture reference, but not a realistic codebase to transplant into an ordinary phone app.

### 2. Smart Dock
Repository: https://github.com/axel358/smartdock

**Type:** Native Android desktop-mode launcher.

**Documented features**
- Desktop and tablet layouts, customizable appearance, multi-window support, and keyboard shortcuts.
- Targets Android 10+ and says root is not required.
- Its README notes some advanced permissions may require system-app installation or Shizuku.

**ORBIT design lessons**
- Separate the app launcher/dock from the underlying Android OS.
- Treat desktop and phone layouts as different responsive compositions.
- Keep customization as a system, not a pile of one-off visual settings.
- Make elevated permissions explicit and optional; do not promise system-level behavior from a normal web app.

### 3. Taskbar
Repository: https://github.com/farmerbb/Taskbar

**Type:** Native Android start-menu/taskbar utility.

**Documented features**
- Start menu with installed-app grid/list, recent-app tray, pinned favorites, and hide/collapse behavior.
- Supports Android desktop mode with compatible external display and freeform windows on supported Android versions.
- Uses Android's existing capabilities and has a Gradle build and Robolectric unit tests.

**ORBIT design lessons**
- Launcher entry points should be predictable: pinned apps, all apps, and recent tasks are distinct concepts.
- A taskbar is contextual and hideable, not a second persistent navigation bar that competes with Android navigation.
- Implement a real app inventory and app launch in the native phase; web prototype tiles should be labelled as internal ORBIT modules, not device apps.

### 4. Boringdroid
Repository: https://github.com/boringdroid/boringdroid  
Architecture notes: https://github.com/boringdroid/boringdroid/blob/boringdroid-14.0.0/ARCHITECTURE.md

**Type:** AOSP patchset and SystemUI desktop integration, not a standalone launcher app.

**Inspected architecture**
- Uses a small, additive patchset over AOSP rather than a separate full Android source tree.
- Enables freeform windows through framework/resource configuration and loads a SystemUI plugin.
- Its plugin renders a single taskbar, app menu, action center, calendar/clock panel, and overview integration.
- Uses runtime resource overlays for configurable system resources; the project documents UI automation tests with stable test tags.

**ORBIT design lessons**
- Avoid duplicate system bars: one authoritative taskbar/navigation layer.
- Separate shell UI from OS/framework integration.
- Only pursue true multi-window, notification shade, system settings, or task-switcher integration in a native/system build where Android APIs and privileges support it.
- Keep acceptance tests attached to concrete UI controls and navigation states.

### 5. MagicDesk
Repository: https://github.com/mekhontsev/magicdesk

**Type:** Advanced native Android workstation/desktop environment.

**Documented architecture and capabilities**
- Android app windows, separate desktops across displays, taskbar/Start, files, terminals, and integrations with Termux/Linux graphical apps.
- Requires Android 14+ for its APK and Android 15+ for managed Desktop, according to its README.
- Privileged features use Shizuku or root; the README distinguishes those from features that work without elevated access.

**ORBIT design lessons**
- Model desktop sessions, files, and running apps as separate parts of the system.
- Preserve a useful phone experience even when a desktop session is not open.
- Distinguish baseline features from those that depend on OS version, special permissions, or external displays.
- This is a future inspiration set, not an MVP scope.

## Comparison: what kind of “OS” exists?

| Project | What it is | Can it replace Android on a phone? | Relevance to ORBIT |
|---|---|---|---|
| Bliss OS | Android-based OS distribution for supported PC hardware | Not as an ordinary installable app; device compatibility/build process matters | OS architecture reference |
| Smart Dock | Android launcher/desktop-mode app | Can act as a launcher on supported setups; does not replace Android | Strong native launcher reference |
| Taskbar | Android taskbar/start-menu utility | No, it adds a launcher/taskbar layer | Useful interaction reference |
| Boringdroid | AOSP/SystemUI patchset | Only as part of a built Android image/ROM | System-level desktop integration reference |
| MagicDesk | Native Android workstation shell | Runs on top of Android; advanced features may require privileged access | Advanced native-workstation reference |
| ORBIT current web build | Web-based environment prototype | No; browser/PWA sandbox | Design prototype only |

## ORBIT direction informed by the review

### Keep the web-first prototype, but change what it claims
- Web phase: polished responsive environment UI, internal ORBIT modules, persisted local demo data, installable PWA for quick app-like entry.
- Native Android phase: a Kotlin/Android shell or launcher app with actual installed-app discovery and launch intents, user-approved default Home selection if desired, native back/home behavior, and Android-aware permission handling.
- Later, only if justified: native taskbar, notifications, desktop mode/external display, freeform windows, or system overlays. These are OS/version/device dependent and should not be faked in the web layer.

### MVP acceptance checks
1. The user can enter ORBIT and return to their usual phone experience through a clear, documented route.
2. On web, internal app tiles open ORBIT modules; no tile implies it launches a device app.
3. On native Android, app discovery/launch uses supported Android APIs and clearly handles unavailable/hidden apps.
4. Do not claim root-free access to system controls or multi-window on every device.
5. No duplicate bottom bars or navigation bars; respect Android system navigation.
6. Validate on the target phone and record OS version, permissions, and actual behavior before declaring a feature complete.

## Source and reuse note

This is a design and architecture study, not a code port. Use the repositories as references for concepts and interaction patterns. Before reusing code, assets, or substantial implementation, review that specific repository's license, attribution requirements, dependencies, and compatibility; preserve upstream authorship and notices.
