// background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "agentic-news-weaver-check",
    title: "Check with Agentic News Weaver",
    contexts: ["selection"]
  });
});

// When user clicks the context menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "agentic-news-weaver-check" && info.selectionText) {
    // Save selected text in storage so popup can read it
    chrome.storage.local.set({ anw_lastSelection: info.selectionText });
    
    // Optionally open popup-like window (or user can click the extension icon)
    // For simplicity we do nothing here; user opens popup manually.
  }
});
