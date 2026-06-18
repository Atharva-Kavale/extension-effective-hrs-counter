# ⏱️ Keka Effective Hrs Counter

> **A Chrome Extension (Manifest V3) that overlays your real-time effective working hours and suggested logout time directly inside the [Keka](https://www.keka.com) attendance page — no tab-switching, no manual maths.**

---

## 🗂️ Table of Contents

- [✨ Features](#-features)
- [📁 Project Structure](#-project-structure)
- [🚀 Installation (Developer Mode)](#-installation-developer-mode)
- [🔍 How It Works](#-how-it-works)
- [🧩 Code Architecture](#-code-architecture)
- [⚙️ Configuration & Constants](#️-configuration--constants)
- [🎨 Styling](#-styling)
- [🐛 Debugging](#-debugging)
- [📜 Permissions](#-permissions)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🕐 **Live Effective Hours** | Calculates and displays your total effective hours in real-time |
| 🚪 **Suggested Logout Time** | Tells you exactly when to leave to complete 9h (or 5h on half-days) |
| 🔄 **Refresh Button** | Manually re-triggers the calculation without a page reload |
| 📅 **Half-Day Support** | Automatically detects badge half-day markers and targets 5h instead of 9h |
| 🔁 **Auto-Retry** | Retries up to 10 times (1 s apart) if the page hasn't fully loaded yet |
| 🌐 **SPA-Aware** | Listens to `navigatesuccess` to work correctly with Keka's Angular SPA routing |

---

## 📁 Project Structure

```
extension-effective-hrs-counter/
│
├── manifest.json          # Extension manifest (MV3)
├── contentScript.js       # All extension logic (single IIFE)
├── contentScript.css      # Widget styles injected alongside the script
│
└── assets/
    ├── clock.svg          # Clock icon shown in the widget
    ├── refresh.png        # Refresh button icon
    └── ext-icon.png       # Extension toolbar icon (16 / 24 / 32 px)
```

---

## 🚀 Installation (Developer Mode)

> [!IMPORTANT]
> This extension is **not published** on the Chrome Web Store. You must load it manually.

1. **Clone / download** this repository to your machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **"Load unpacked"** and select the project root folder  
   (`extension-effective-hrs-counter/`).
5. The extension icon will appear in your toolbar. ✅
6. Navigate to your Keka attendance logs page:  
   `https://<your-org>.keka.com/#/me/attendance/logs`

The widget will automatically appear in the attendance stats card. 🎉

---

## 🔍 How It Works

```
Page Load / URL Change
        │
        ▼
 URL ends with #/me/attendance/logs ?
        │ YES
        ▼
  Wait 1 second (page hydration)
        │
        ▼
  Find lastLogBody via XPath
        │ null? → throw → retry (up to 10×)
        ▼
  Find latestLog row inside lastLogBody
        │ null? → isUserLogged = false → show "User not logged yet"
        ▼
  Click the log row to expand details
        │
        ▼
  Read effective hours from .open span
        │
        ▼
  Last entry is "MISSING"?
  ├── YES → add elapsed time since clock-in to effective hours
  └── NO  → use effective hours as-is
        │
        ▼
  Compute suggested logout time
  (target = 9h, or 5h if half-day badge detected)
        │
        ▼
  Inject widget into attendance stats card
        │
        ▼
  [Refresh button] → remove widget → re-run scriptRunner()
```

---

## 🧩 Code Architecture

The entire extension logic lives in a single **IIFE** (`contentScript.js`) split into clearly separated sections:

---

### 🔵 State

```js
let count = 0; // retry counter (max 10)
```

---

### 🟣 Logger

A styled console logger that prefixes every message with a coloured badge so extension logs are instantly distinguishable from the site's own console output.

| Level | Badge colour | Method |
|---|---|---|
| `info` | 🟣 Indigo | `logger.info(...)` |
| `warn` | 🟡 Amber | `logger.warn(...)` |
| `error` | 🔴 Red | `logger.error(...)` |

---

### 🟠 XPath Constants

Four XPath expressions target specific Angular-rendered DOM nodes on the Keka attendance page:

| Constant | Points to |
|---|---|
| `CARD_BODY_XPATH` | The stats card container where the widget is injected |
| `LAST_LOG_BODY_XPATH` | The wrapper element holding today's log rows |
| `LAST_LOG_XPATH` | The clickable span of the latest log row |
| `LOG_DATA_XPATH` | The expanded detail container with clock-in/out spans |

> [!WARNING]
> These XPaths are tightly coupled to Keka's DOM structure. If Keka updates their Angular templates, these may break and will need updating.

---

### 🟢 DOM Utility Helpers

#### `createElement(tag)`
Thin wrapper around `document.createElement`.

#### `getByXpath(path, parentEle = document)`
Evaluates an XPath expression and returns the first matching node.

> [!NOTE]
> Returns `null` safely if `parentEle` is `null` — preventing the  
> `TypeError: parameter 2 is not of type 'Node'` error from `document.evaluate`.

---

### 🔵 Pure Time Helpers

#### `dateArrToSec([hh, mm, ss])` → `number`
Converts a `[hours, minutes, seconds]` array to total seconds.

#### `secToDateArr(totalSec)` → `[hh, mm]`
Converts total seconds back to a `[hours, minutes]` tuple.

#### `getDiff(lDate)` → `[hh, mm]`
Computes elapsed time between a given AM/PM clock-in time string and **now**.

```
Input:  ["09", "30", "00", "AM"]
Output: [7, 45]   // if current time is 5:15 PM
```

#### `sumHoursMinutes(diffArr, eArr)` → `string`
Adds two `[hh, mm]` tuples (with minute carry-over) and returns `"Xh : Ym"`.

#### `computeLogoutTime(fTime, isHalfDay)` → `string | null`

Calculates the suggested logout time so total effective hours reach the target.

```
Target hours:
  ├── 9h  → standard day  (isHalfDay = false)
  └── 5h  → half-day      (isHalfDay = true)

Returns null if the target has already been exceeded.
```

> [!NOTE]
> `isHalfDay` is resolved by the caller (`computeFinalTime`) via a single DOM check,
> keeping this function pure with no side-effects.

---

### 🟡 DOM Queries

| Function | Returns |
|---|---|
| `getCardBody()` | The stats card container element |
| `getLastLogBody()` | The today's log section wrapper |
| `getLatestLog(parentEle)` | The latest log row's clickable span |
| `getLogData()` | NodeList of `span.ng-star-inserted` inside the expanded log detail |

---

### 🟠 Parsing

#### `parseClockIn(logData)` → `string[]`
Reads the second-to-last span in the expanded log detail (which contains the clock-in timestamp) and splits it into `["HH", "MM", "SS", "AM|PM"]` format.

#### `computeFinalTime(logData)` → `{ fTime, logoutTime }`
The core business logic:

```
Resolve isHalfDay from DOM (.badge presence)

If last log entry === "MISSING"  (user is still clocked in):
    fTime      = effectiveHours + elapsedTimeSinceClockIn
    logoutTime = computeLogoutTime(fTime, isHalfDay)
Else:
    fTime      = effectiveHoursAsIs
    logoutTime = null
```

---

### 🔴 Rendering — `paintToDOM`

Builds and injects the widget DOM into the Keka stats card:

```
┌──────────────────────────────┐
│  🕐  8h : 45m          🔄   │
│  Logout time : 6:15 PM       │
└──────────────────────────────┘
```

- **Clock icon** (`clock.svg`) on the left
- **Time label** (`.keka-ext-label`) in the centre
- **Refresh button** (`refresh.png`) on the right — spins in with a 2-second CSS transition on first render
- **Logout time** row below (hidden if `null`)

Any previously injected widget is removed before re-rendering to avoid duplicates.

---

### 🟢 Orchestrator — `scriptRunner()`

Ties all of the above together in sequence:

1. Find `lastLogBody` → throw if missing (triggers retry)
2. Find `latestLog` → if absent, show "not logged" state
3. Click the log row to expand details
4. Read & compute hours
5. Paint widget
6. Re-click to collapse (restore Keka's original UI state)

---

### 🔵 Retry Logic — `runWithRetry()`

Wraps `scriptRunner()` in a try/catch. On failure, waits **1 second** and retries up to **10 times**. The retry counter (`count`) is reset to `0` on every fresh navigation so retries are always available on each new page visit.

---

### 🟣 Entry Point

```js
navigation.addEventListener("navigatesuccess", () => {
  handleUrlChange(window.location.href);
});
```

Listens to the browser's **Navigation API** (`navigatesuccess`) so the script re-runs whenever the user navigates to the attendance logs URL within the Keka SPA — without requiring a full page reload.

---

## ⚙️ Configuration & Constants

| Constant | File | Default | Purpose |
|---|---|---|---|
| `CARD_BODY_XPATH` | `contentScript.js` | *(long XPath)* | Where to inject the widget |
| `LAST_LOG_BODY_XPATH` | `contentScript.js` | *(long XPath)* | Log list wrapper |
| `LAST_LOG_XPATH` | `contentScript.js` | *(long XPath)* | Clickable log row |
| `LOG_DATA_XPATH` | `contentScript.js` | *(long XPath)* | Expanded detail spans |
| Target hours (full day) | `contentScript.js` | `9` | Hardcoded in `computeLogoutTime` |
| Target hours (half day) | `contentScript.js` | `5` | When `.badge` element found |
| Max retries | `contentScript.js` | `10` | In `runWithRetry()` |
| Retry delay | `contentScript.js` | `1000 ms` | In `runWithRetry()` |
| Initial delay | `contentScript.js` | `1000 ms` | In `handleUrlChange()` |

---

## 🎨 Styling

All widget styles are in [`contentScript.css`](./contentScript.css) and are injected alongside the script via `manifest.json`.

| Class | Purpose |
|---|---|
| `.keka-ext-wrapper` | Flex column container wrapping the time row and logout line |
| `.keka-ext-row` | Flex row wrapping the icon, time label, and refresh button |
| `.keka-ext-label` | 18px semi-bold time display |
| `.keka-ext-btn` | Refresh button — starts at `opacity: 0`, `rotate: 0deg` |
| `.keka-ext-btn.spin` | Added by JS to trigger the 2-second spin + fade-in transition |
| `.keka-ext-logout-time` | Logout time subtitle row (13px, muted grey) |
| `.keka-ext-logout-time.hidden` | Hides the logout row when no logout time is available |

---

## 🐛 Debugging

All extension logs are prefixed with a coloured `Keka Ext` badge in the browser console. Open DevTools (`F12`) on the Keka attendance page and look for:

```
[🟣 Keka Ext] URL matched — starting script...
[🟣 Keka Ext] Retrying...
[🔴 Keka Ext] Unknown error (attempt 3/10)  TypeError: ...
```

> [!TIP]
> If the widget never appears, check the Console for XPath errors. The most common cause is a Keka DOM update that broke one of the XPath selectors. Inspect the attendance page and update the relevant `*_XPATH` constant in `contentScript.js`.

---

## 📜 Permissions

| Permission | Reason |
|---|---|
| `host_permissions: https://*.keka.com/*` | Allows the content script to run on all Keka subdomains |

> [!NOTE]
> No data is ever sent to any external server. All computation happens locally in the browser tab.

---

<div align="center">
  Made with ❤️ to save you from doing attendance maths manually.
</div>
