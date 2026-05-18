---
component_id: 2.1
component_name: Message Router & Orchestrator
---

# Message Router & Orchestrator

## Component Description

The primary entry point for all extension events. It manages the lifecycle of the background worker, listens for cross-component messages via the Chrome Runtime, and dispatches tasks to specialized logic handlers based on the action type.

---

## Key References:

### d:\trans extension\js\background.js (lines 14-40)
```
async function startSnap(tab) {
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://")) {
    console.error("Cannot snap on browser UI pages");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "START_SNAP" }).catch(async () => {
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["css/content.css"] });
      await chrome.scripting.executeScript({ 
        target: { tabId: tab.id }, 
        files: ["lib/tesseract.min.js", "lib/jsQR.js", "js/content.js"] 
      });
      chrome.tabs.sendMessage(tab.id, { action: "START_SNAP" });
    } catch (e) {
      console.log("Cannot start snap even with dynamic injection fallback: ", e);
      if (tab.url.startsWith("file://")) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "assets/icon.png",
          title: "Cấp quyền cho File PDF cục bộ",
          message: "Để Snap trên file PDF lưu trên máy (file://), hãy mở chi tiết Extension này và bật tính năng 'Allow access to file URLs'."
        });
      }
    }
  });
}
```


## Source Files:

- `js\background.js`

