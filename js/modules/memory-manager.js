// ═══════════════════════════════════════════════════════════
// MEMORY-MANAGER.JS — Quản lý lịch sử Snap
// ═══════════════════════════════════════════════════════════

const MEMORY_KEY = "snap_history";
const MAX_ENTRIES = 100;

export async function saveSnap(entry) {
  const history = await getHistory();
  history.unshift({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    mode: entry.mode || "translate",
    ocrText: entry.ocrText || "",
    translation: entry.translation || "",
    sourceUrl: entry.sourceUrl || "",
    confidence: entry.confidence || 0
  });

  if (history.length > MAX_ENTRIES) {
    history.length = MAX_ENTRIES;
  }

  await chrome.storage.local.set({ [MEMORY_KEY]: history });
  return history;
}

export async function getHistory() {
  const result = await chrome.storage.local.get(MEMORY_KEY);
  return result[MEMORY_KEY] || [];
}

export async function deleteSnap(id) {
  const history = await getHistory();
  const filtered = history.filter(entry => entry.id !== id);
  await chrome.storage.local.set({ [MEMORY_KEY]: filtered });
  return filtered;
}

export async function clearHistory() {
  await chrome.storage.local.set({ [MEMORY_KEY]: [] });
  return [];
}

export async function searchHistory(query) {
  const history = await getHistory();
  if (!query.trim()) return history;

  const lowerQuery = query.toLowerCase();
  return history.filter(entry =>
    (entry.ocrText && entry.ocrText.toLowerCase().includes(lowerQuery)) ||
    (entry.translation && entry.translation.toLowerCase().includes(lowerQuery))
  );
}
