// content.js

// Listen for requests from popup or background asking for current selection
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_SELECTION") {
    const selection = window.getSelection ? window.getSelection().toString() : "";
    sendResponse({ text: selection });
  }
});
