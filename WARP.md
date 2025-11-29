# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project overview

This repository contains a Chrome-compatible Manifest V3 browser extension called **Agentic News Weaver**. It analyzes highlighted text on web pages by sending it to a remote API that returns a truthfulness score and label (e.g., fact vs myth), which are then rendered in a polished popup UI.

The extension is implemented with plain JavaScript, HTML, and CSS and does **not** use any bundler, package manager, or test framework.

## Commands & tooling

There is no build system or Node-based tooling configured in this repository.

- **Build / run:**
  - No build step is required. The browser loads the source files (`manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `popup.css`, icons) directly.
  - To run the extension, load this folder as an **unpacked extension** in a Chromium-based browser (e.g., Chrome, Edge) via `chrome://extensions` → "Developer mode" → "Load unpacked".
- **Linting:**
  - No linter configuration or scripts are present. If you introduce ESLint or similar tools, update this section with the relevant commands.
- **Tests:**
  - There is no automated test suite or test runner configured.
- **Packaging for distribution (manual):**
  - To ship the extension as a `.zip`, package the contents of this directory (keeping the root structure the same) using your OS tooling. Example on PowerShell from the repo root:
    - `Compress-Archive -Path * -DestinationPath ..\agentic-news-weaver.zip`

## Architecture & data flow

### Manifest and top-level wiring (`manifest.json`)

- Uses **Manifest V3** (`"manifest_version": 3`).
- Declares a browser action popup (`"default_popup": "popup.html"`).
- Registers:
  - A **background service worker** (`background.js`, `type: module`).
  - A **content script** (`content.js`) injected on `<all_urls>` at `document_idle`.
- Requests permissions: `activeTab`, `scripting`, `contextMenus`, `storage`, and host permissions for `<all_urls>`.

This file controls how the other pieces of the extension are wired together and which pages it can interact with.

### Background service worker (`background.js`)

- Runs as a Manifest V3 **service worker**.
- On install, it registers a single context menu item:
  - ID: `"agentic-news-weaver-check"`.
  - Title: "Check with Agentic News Weaver".
  - Context: only when text is selected (`contexts: ["selection"]`).
- When the menu item is clicked with a selection:
  - Saves the selected text in `chrome.storage.local` under the key `anw_lastSelection`.
  - Does **not** open the popup automatically; the user opens the extension popup via the browser UI.

The background script is responsible for creating the context menu and persisting the last selected text so the popup can retrieve it later.

### Content script (`content.js`)

- Injected on all pages (`"matches": ["<all_urls>"]`).
- Listens for runtime messages and handles a single message type:
  - `type: "GET_SELECTION"` → returns the current `window.getSelection().toString()`.

This script is the only code that directly accesses page content. The popup and background communicate with it via `chrome.tabs.sendMessage`.

### Popup UI (`popup.html`, `popup.js`, `popup.css`)

- **`popup.html`** defines the extension UI:
  - A header with branding.
  - A textarea (`#text-input`) for the text to analyze.
  - Two buttons: `#use-selection-btn` (load selection from the page) and `#analyze-btn` (send to backend).
  - A hidden result section showing a label badge (`#label-badge`), a percentage score (`#score-text`), and a textual explanation (`#result-description`).
  - A status area (`#status-text`) for user-facing status and error messages.
- **`popup.css`** provides styling for the dark-themed, card-based layout.
- **`popup.js`** is the main orchestration layer:
  - Holds UI element references and an `API_URL` constant pointing to the backend endpoint.
  - **Status handling:** `setStatus` updates `#status-text` and controls visibility of result vs error states.
  - **Result rendering:** `showResult(data)` expects JSON with at least:
    - `truth_score` (0–1 or 0–100; converted to a percentage and shown in `#score-text`).
    - `label` (expected values include `"fact"` and `"myth"`; drives the badge text and styling).
    - `explanation` (displayed as result copy; falls back to default fact/myth/neutral messages when missing).
  - **Analysis flow:** `analyzeText()`
    - Reads and trims the textarea contents.
    - If empty, shows a status message and hides results.
    - Otherwise, sends a `POST` request to `API_URL` with body `{ text }`.
    - On HTTP error, surfaces a generic status message and logs details to the console.
    - On success, passes the parsed JSON to `showResult` and clears the status.
  - **Selection loading on popup open:** `loadSelectionOnOpen()`
    - Queries the active tab.
    - Sends a `GET_SELECTION` message to the content script in that tab.
    - If messaging fails (e.g., no content script on the page), falls back to `restoreStoredSelection()`.
    - If selection text is present, fills `#text-input` and shows a status ("Loaded text from current selection.").
  - **Fallback from background storage:** `restoreStoredSelection()`
    - Reads `anw_lastSelection` from `chrome.storage.local` (set by the context menu handler).
    - If present, puts it into `#text-input` and sets an appropriate status.
    - Otherwise, prompts the user to paste text or use the selection flow.
  - **"Use selection" button:** `handleUseSelectionClick()`
    - Explicitly re-queries the active tab and sends `GET_SELECTION`.
    - Updates `#text-input` and status based on whether text is returned.
  - On `DOMContentLoaded`, attaches listeners and immediately attempts to load selection text.

### Remote API contract

- The popup posts to `API_URL` with JSON payload `{ text: string }`.
- It expects a JSON response with (at least) the following shape:
  - `truth_score`: numeric; treated as 0–1 or 0–100 and rendered as a percentage.
  - `label`: string; recognized values `"fact"` and `"myth"` are given special badge styles.
  - `explanation`: string; used as the primary explanation text.
- The UI is resilient to partially populated responses (missing fields fall back to safe defaults), but behavior is tuned for this contract.

If you change the backend shape, update `showResult` and any explanatory copy to stay aligned.

## Implementation notes for future changes

- **API endpoint (`API_URL` in `popup.js`):**
  - Currently points to a specific HTTP endpoint (an ngrok-style URL). When moving to a stable backend, update this constant and keep error handling and response parsing in sync with the server.
- **Permissions and scope:**
  - The extension currently requests broad host permissions (`"<all_urls>"`) and injects the content script on all pages. If you narrow the scope, adjust both `host_permissions` and `content_scripts.matches` together.
- **Message contracts:**
  - The popup and content script are loosely coupled via the `"GET_SELECTION"` message type and the `anw_lastSelection` storage key. Keep these identifiers synchronized across files if you rename them.
- **Background / popup interaction:**
  - The background script only persists selection text; all UI state and result rendering lives in the popup. Changes to how selection is stored or keyed should be mirrored in `restoreStoredSelection()` in `popup.js`.
