/**
 * Nuanu Interview Transcriber — background service worker.
 *
 * Minimal: keeps the toolbar badge in sync with the transcription session
 * state (stored in chrome.storage.local by the popup / content script) so
 * the HR user can see at a glance whether transcription is active.
 */

const BADGE_ACTIVE = { text: "REC", color: "#dc2626" };
const BADGE_IDLE = { text: "", color: "#9ca3af" };

function updateBadge() {
  chrome.storage.local.get(["session"], (data) => {
    const active = !!(data && data.session && data.session.active);
    chrome.action.setBadgeText(
      active ? { text: BADGE_ACTIVE.text } : { text: BADGE_IDLE.text },
    );
    chrome.action.setBadgeBackgroundColor(
      active ? { color: BADGE_ACTIVE.color } : { color: BADGE_IDLE.color },
    );
  });
}

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.session) updateBadge();
});

// Relay messages between popup and content script (popup → tab → content).
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "GET_TAB_SESSION_STATE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id || !tab.url || !tab.url.startsWith("https://meet.google.com/")) {
        sendResponse({ onMeet: false });
        return;
      }
      chrome.tabs.sendMessage(
        tab.id,
        { type: "SESSION_STATE" },
        (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ onMeet: true, error: chrome.runtime.lastError.message });
            return;
          }
          sendResponse({ onMeet: true, ...response });
        },
      );
    });
    return true; // async sendResponse
  }
  return false;
});
