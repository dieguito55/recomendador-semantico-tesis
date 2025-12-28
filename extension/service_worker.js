// service_worker.js
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "UNAP_PING" });
    return true;
  } catch (e) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["panel.css"] });
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      return true;
    } catch (e2) { return false; }
  }
}

function isSupportedRepoUrl(url) {
  return /^https:\/\/repositorio\.(unap|unsa|unsaac)\.edu\.pe\//i.test(url || "");
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id || !isSupportedRepoUrl(tab.url)) return;

  if (await ensureContentScript(tab.id)) {
    chrome.tabs.sendMessage(tab.id, { type: "UNAP_TOGGLE_PANEL" }).catch(() => {});
  }
});
