// ═══════════════════════════════════════════════════════════
// MEMORY-MANAGER.JS — Quản lý lịch sử Snap
// ═══════════════════════════════════════════════════════════

const MEMORY_KEY = "snap_history";
const DEFAULT_MAX_ENTRIES = 50;

async function getMaxEntries() {
  const result = await chrome.storage.sync.get({ memoryLimit: DEFAULT_MAX_ENTRIES });
  return result.memoryLimit || DEFAULT_MAX_ENTRIES;
}

export async function saveSnap(entry) {
  const history = await getHistory();
  const maxEntries = await getMaxEntries();

  history.unshift({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    mode: entry.mode || "translate",
    ocrText: entry.ocrText || "",
    translation: entry.translation || "",
    sourceUrl: entry.sourceUrl || "",
    confidence: entry.confidence || 0
  });

  if (history.length > maxEntries) {
    history.length = maxEntries;
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

export async function setMaxEntries(limit) {
  const clamped = Math.max(10, Math.min(500, limit));
  await chrome.storage.sync.set({ memoryLimit: clamped });

  const history = await getHistory();
  if (history.length > clamped) {
    history.length = clamped;
    await chrome.storage.local.set({ [MEMORY_KEY]: history });
  }
  return clamped;
}

export async function getMaxEntriesSetting() {
  return await getMaxEntries();
}
