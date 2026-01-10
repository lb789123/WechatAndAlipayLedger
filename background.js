// ====== Extension Background Service Worker ======
// This service worker handles the extension toolbar icon click
// and opens the app page (index.html) in a new tab.

// Listen for toolbar icon click
chrome.action.onClicked.addListener((tab) => {
  // Open the app page in a new tab
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});

// Message listener placeholder for future communication
// between content scripts, popup, or app pages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  // Add message handling logic here as needed
  sendResponse({ received: true });
  return true; // Keep channel open for async response
});

console.log('Extension background service worker loaded');
