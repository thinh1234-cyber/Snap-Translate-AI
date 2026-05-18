// ═══════════════════════════════════════════════════════════
// FILE-SAVER.JS — Lưu ảnh PNG + text vào thư mục Downloads
// ═══════════════════════════════════════════════════════════

const FILE_SAVE_KEY = "saved_files";
const AUTO_DELETE_DAYS = 30;

function padNumber(num, width = 3) {
  return String(num).padStart(width, "0");
}

function formatTimestamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}_${h}-${min}-${s}`;
}

async function getNextSequence() {
  const files = await getSavedFiles();
  return files.length + 1;
}

async function getSavedFiles() {
  const result = await chrome.storage.local.get(FILE_SAVE_KEY);
  return result[FILE_SAVE_KEY] || [];
}

async function addSavedFile(entry) {
  const files = await getSavedFiles();
  files.push(entry);
  await chrome.storage.local.set({ [FILE_SAVE_KEY]: files });
  return files;
}

async function removeSavedFile(id) {
  const files = await getSavedFiles();
  const filtered = files.filter(f => f.id !== id);
  await chrome.storage.local.set({ [FILE_SAVE_KEY]: filtered });
  return filtered;
}

async function clearSavedFiles() {
  await chrome.storage.local.set({ [FILE_SAVE_KEY]: [] });
  return [];
}

function downloadBlob(blob, filename) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: `snap-translate/${filename}`,
      saveAs: false,
      conflictAction: "uniquify"
    }, (downloadId) => {
      URL.revokeObjectURL(url);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
    });
  });
}

export async function saveSnapFiles(dataUrl, textContent, mode) {
  const seq = await getNextSequence();
  const timestamp = new Date();
  const tsStr = formatTimestamp(timestamp);
  const seqStr = padNumber(seq);
  const baseName = `${seqStr}_${tsStr}`;

  const pngFilename = `${baseName}.png`;
  const txtFilename = `${baseName}.txt`;

  const results = { png: null, txt: null, errors: [] };

  try {
    const pngBlob = await (await fetch(dataUrl)).blob();
    const pngId = await downloadBlob(pngBlob, pngFilename);
    results.png = { filename: pngFilename, downloadId: pngId };
  } catch (e) {
    results.errors.push(`PNG: ${e.message}`);
  }

  try {
    const header = `=== Snap & Translate AI ===\nSTT: ${seq}\nThời gian: ${timestamp.toLocaleString('vi-VN')}\nChế độ: ${mode === "qr" ? "QR Code" : "Dịch thuật"}\n\n`;
    const txtContent = header + (textContent || "(Không có nội dung)");
    const txtBlob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
    const txtId = await downloadBlob(txtBlob, txtFilename);
    results.txt = { filename: txtFilename, downloadId: txtId };
  } catch (e) {
    results.errors.push(`TXT: ${e.message}`);
  }

  if (results.png || results.txt) {
    await addSavedFile({
      id: `${seq}_${Date.now()}`,
      sequence: seq,
      timestamp: timestamp.toISOString(),
      mode: mode || "translate",
      pngFilename: results.png?.filename || null,
      txtFilename: results.txt?.filename || null,
      pngDownloadId: results.png?.downloadId || null,
      txtDownloadId: results.txt?.downloadId || null,
      errors: results.errors
    });
  }

  return results;
}

export async function autoDeleteOldFiles() {
  const files = await getSavedFiles();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - AUTO_DELETE_DAYS);

  const toDelete = files.filter(f => new Date(f.timestamp) < cutoff);
  const toKeep = files.filter(f => new Date(f.timestamp) >= cutoff);

  for (const file of toDelete) {
    if (file.pngDownloadId) {
      try { await chrome.downloads.erase({ id: file.pngDownloadId }); } catch (e) {}
    }
    if (file.txtDownloadId) {
      try { await chrome.downloads.erase({ id: file.txtDownloadId }); } catch (e) {}
    }
  }

  if (toDelete.length > 0) {
    await chrome.storage.local.set({ [FILE_SAVE_KEY]: toKeep });
  }

  return { deleted: toDelete.length, remaining: toKeep.length };
}

export async function deleteSavedFile(id) {
  const files = await getSavedFiles();
  const file = files.find(f => f.id === id);
  if (!file) return { success: false };

  if (file.pngDownloadId) {
    try { await chrome.downloads.erase({ id: file.pngDownloadId }); } catch (e) {}
  }
  if (file.txtDownloadId) {
    try { await chrome.downloads.erase({ id: file.txtDownloadId }); } catch (e) {}
  }

  return await removeSavedFile(id);
}

export async function getSavedFilesList() {
  return await getSavedFiles();
}
