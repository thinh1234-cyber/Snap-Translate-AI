---
component_id: 1
component_name: User Interface & Interaction Layer
---

# User Interface & Interaction Layer

## Component Description

Manages the visual overlay on web pages for area selection and the configuration interfaces. It handles user input events, manages the Snap selection box, and displays the final results (OCR text or translations) to the user.

---

## Key References:

### d:\trans extension\js\content.js (lines 15-35)
```
  function initSnapOverlay() {
    if (document.getElementById("snap-translate-overlay")) return;

    const container = document.fullscreenElement || document.body;

    overlay = document.createElement("div");
    overlay.id = "snap-translate-overlay";

    selectionBox = document.createElement("div");
    selectionBox.id = "snap-translate-selection";
    selectionBox.style.display = "none";

    overlay.appendChild(selectionBox);
    container.appendChild(overlay);

    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);

    document.addEventListener("keydown", onKeyDown);
  }
```

### d:\trans extension\js\content.js (lines 90-102)
```
  async function processSnap(rect) {
    showPopupLoading();

    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "CAPTURE_SCREEN" }, (response) => {
        if (response && response.dataUrl) {
          cropImage(response.dataUrl, rect);
        } else {
          updatePopupError("Không thể chụp nền màn hình.");
        }
      });
    }, 50);
  }
```


## Source Files:

- `js\architecture.js`
- `js\config.js`
- `js\content.js`
- `js\options.js`
- `js\popup.js`

