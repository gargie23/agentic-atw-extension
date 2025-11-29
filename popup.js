// popup.js

const textInput = document.getElementById("text-input");
const useSelectionBtn = document.getElementById("use-selection-btn");
const analyzeBtn = document.getElementById("analyze-btn");
const resultSection = document.getElementById("result-section");
const labelBadge = document.getElementById("label-badge");
const scoreText = document.getElementById("score-text");
const resultDescription = document.getElementById("result-description");
const statusText = document.getElementById("status-text");

const API_URL = "https://your-api-domain.com/api/check-news"; // <-- change this

function setStatus(msg) {
  statusText.textContent = msg || "";
}

function showResult(data) {
  // Expecting: { truth_score: 0.82, label: "fact" | "myth", explanation: "..." }
  const score = data.truth_score != null ? Number(data.truth_score) : null;
  const label = (data.label || "").toLowerCase();
  const explanation = data.explanation || "";

  if (score != null) {
    const percentage = score <= 1 ? score * 100 : score; // handle 0–1 vs 0–100
    scoreText.textContent = `${percentage.toFixed(0)}%`;
  } else {
    scoreText.textContent = "--%";
  }

  labelBadge.classList.remove("fact", "myth");

  if (label === "fact") {
    labelBadge.textContent = "FACT";
    labelBadge.classList.add("fact");
  } else if (label === "myth") {
    labelBadge.textContent = "MYTH";
    labelBadge.classList.add("myth");
  } else {
    labelBadge.textContent = label || "RESULT";
  }

  resultDescription.textContent =
    explanation ||
    (label === "fact"
      ? "This statement appears likely to be true based on the model."
      : label === "myth"
      ? "This statement appears likely to be false or misleading based on the model."
      : "Analysis complete. Review details carefully and verify with reliable sources.");

  resultSection.classList.remove("hidden");
}

function analyzeText() {
  const text = textInput.value.trim();
  if (!text) {
    setStatus("Please enter or select some text to analyze.");
    resultSection.classList.add("hidden");
    return;
  }

  setStatus("Analyzing…");
  resultSection.classList.add("hidden");

  fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
      // Add Authorization header here if needed:
      // "Authorization": "Bearer <token>"
    },
    body: JSON.stringify({ text })
  })
    .then(async (res) => {
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Request failed with status ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      showResult(data);
      setStatus("");
    })
    .catch((err) => {
      console.error("Error calling API:", err);
      setStatus("Error: unable to analyze text. Check console for details.");
    });
}

// Try to auto-fill from selection when popup opens
function loadSelectionOnOpen() {
  // 1. Ask active tab for current selection
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) return;

    chrome.tabs.sendMessage(
      tab.id,
      { type: "GET_SELECTION" },
      (response) => {
        if (chrome.runtime.lastError) {
          // Content script may not be injected on some pages
          // Fallback to stored selection
          restoreStoredSelection();
          return;
        }

        const selectedText = response && response.text;
        if (selectedText && selectedText.trim()) {
          textInput.value = selectedText.trim();
          setStatus("Loaded text from current selection.");
        } else {
          // Fallback to stored selection (from context menu)
          restoreStoredSelection();
        }
      }
    );
  });
}

// Retrieve selection saved from context menu
function restoreStoredSelection() {
  chrome.storage.local.get(["anw_lastSelection"], (res) => {
    if (res.anw_lastSelection && res.anw_lastSelection.trim()) {
      textInput.value = res.anw_lastSelection.trim();
      setStatus("Loaded text from context menu selection.");
    } else {
      setStatus("Paste text or use 'Use selection' to load from the page.");
    }
  });
}

// When user clicks "Use selection"
function handleUseSelectionClick() {
  setStatus("Fetching selection from page…");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      setStatus("No active tab.");
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { type: "GET_SELECTION" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error getting selection:", chrome.runtime.lastError);
          setStatus("Unable to read selection on this page.");
          return;
        }

        const selectedText = response && response.text;
        if (selectedText && selectedText.trim()) {
          textInput.value = selectedText.trim();
          setStatus("Selection loaded.");
        } else {
          setStatus("No text selected. Highlight some text and try again.");
        }
      }
    );
  });
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  loadSelectionOnOpen();
  useSelectionBtn.addEventListener("click", handleUseSelectionClick);
  analyzeBtn.addEventListener("click", analyzeText);
});
