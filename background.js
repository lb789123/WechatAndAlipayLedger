// ====== Extension Background Service Worker ======
// This service worker handles the extension toolbar icon click
// and opens the app in a new tab.

// Listen for toolbar icon click
chrome.action.onClicked.addListener((tab) => {
  // Open index.html in a new tab
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});

// Message listener placeholder for future extension functionality
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages from content scripts or app pages if needed
  console.log('Background received message:', message);
  
  // Example: respond to ping messages
  if (message.type === 'ping') {
    sendResponse({ status: 'pong' });
  }
  
  return true; // Keep message channel open for async responses
});

console.log('Ledger extension background service worker initialized');
