import fs from 'fs';
import path from 'path';
import type { WatchlistGroup } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CACHE_FILE = path.join(DATA_DIR, 'local_cache.json');

interface LocalStorageSchema {
  stockQueries: any[];
  watchlistGroups: WatchlistGroup[];
  watchlistGroupSyncTime: string | null;
  watchlistItems: Record<string, any[]>;
  watchlistItemsSyncTime: Record<string, string>;
  emitenFlags: Record<string, string>;
  profileSettings: Record<string, string>;
  sessions: Record<string, any>;
  stories: any[];
  jobLogs: any[];
}

const memoryStore: LocalStorageSchema = {
  stockQueries: [],
  watchlistGroups: [],
  watchlistGroupSyncTime: null,
  watchlistItems: {},
  watchlistItemsSyncTime: {},
  emitenFlags: {},
  profileSettings: {},
  sessions: {},
  stories: [],
  jobLogs: [],
};

let isLoaded = false;

function loadFromDisk() {
  if (isLoaded) return;
  isLoaded = true;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(memoryStore, parsed);
      }
    }
  } catch (err) {
    console.warn('[LocalStore] Failed to read local_cache.json:', err);
  }
}

function saveToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(memoryStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[LocalStore] Failed to write local_cache.json:', err);
  }
}

loadFromDisk();

export function saveStockQueryLocal(data: any) {
  loadFromDisk();
  const existingIdx = memoryStore.stockQueries.findIndex(
    (q) => q.from_date === data.from_date && q.emiten?.toUpperCase() === data.emiten?.toUpperCase()
  );
  const record = {
    id: data.id || Date.now(),
    created_at: data.created_at || new Date().toISOString(),
    status: data.status || 'success',
    ...data,
    emiten: data.emiten?.toUpperCase(),
  };

  if (existingIdx >= 0) {
    memoryStore.stockQueries[existingIdx] = {
      ...memoryStore.stockQueries[existingIdx],
      ...record,
    };
  } else {
    memoryStore.stockQueries.unshift(record);
  }
  saveToDisk();
  return [record];
}

export function getWatchlistAnalysisHistoryLocal(filters?: {
  emiten?: string;
  sector?: string;
  fromDate?: string;
  toDate?: string;
  status?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  loadFromDisk();
  let list = [...memoryStore.stockQueries];

  if (filters?.emiten) {
    const emitenList = filters.emiten.split(/\s+/).filter(Boolean).map((e) => e.toUpperCase());
    if (emitenList.length > 0) {
      list = list.filter((q) => emitenList.includes(q.emiten?.toUpperCase()));
    }
  }
  if (filters?.sector && filters.sector !== 'all') {
    list = list.filter((q) => q.sector === filters.sector);
  }
  if (filters?.fromDate) {
    list = list.filter((q) => (q.from_date || '') >= filters.fromDate!);
  }
  if (filters?.toDate) {
    list = list.filter((q) => (q.from_date || '') <= filters.toDate!);
  }
  if (filters?.status && filters.status !== 'all') {
    list = list.filter((q) => q.status === filters.status);
  }

  const sortBy = filters?.sortBy || 'from_date';
  const sortOrder = filters?.sortOrder || 'desc';

  list.sort((a, b) => {
    const valA = a[sortBy] ?? '';
    const valB = b[sortBy] ?? '';
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = list.length;
  const offset = filters?.offset || 0;
  const limit = filters?.limit || 50;

  return {
    data: list.slice(offset, offset + limit),
    count: total,
  };
}

export function getLatestStockQueryLocal(emiten: string) {
  loadFromDisk();
  const upper = emiten.trim().toUpperCase();
  const matches = memoryStore.stockQueries
    .filter((q) => q.emiten?.toUpperCase() === upper && q.status === 'success')
    .sort((a, b) => (b.from_date || '').localeCompare(a.from_date || ''));
  return matches[0] || null;
}

export function getSpecificStockQueryLocal(emiten: string, fromDate: string, toDate: string) {
  loadFromDisk();
  const upper = emiten.trim().toUpperCase();
  return (
    memoryStore.stockQueries.find(
      (q) =>
        q.emiten?.toUpperCase() === upper &&
        q.from_date === fromDate &&
        q.to_date === toDate &&
        q.status === 'success'
    ) || null
  );
}

export function getStockPriceByDateLocal(emiten: string, date: string) {
  loadFromDisk();
  const upper = emiten.trim().toUpperCase();
  const match = memoryStore.stockQueries.find(
    (q) => q.emiten?.toUpperCase() === upper && q.from_date === date && q.status === 'success'
  );
  if (!match) return null;
  return {
    harga: match.harga,
    ara: match.ara,
    arb: match.arb,
    total_bid: match.total_bid,
    total_offer: match.total_offer,
    fraksi: match.fraksi,
  };
}

export function updatePreviousDayRealPriceLocal(
  emiten: string,
  currentDate: string,
  price: number,
  maxPrice?: number
) {
  loadFromDisk();
  const upper = emiten.trim().toUpperCase();
  const matches = memoryStore.stockQueries
    .filter((q) => q.emiten?.toUpperCase() === upper && q.status === 'success' && q.from_date < currentDate)
    .sort((a, b) => (b.from_date || '').localeCompare(a.from_date || ''));

  if (matches.length > 0) {
    matches[0].real_harga = price;
    if (maxPrice !== undefined) {
      matches[0].max_harga = maxPrice;
    }
    saveToDisk();
    return [matches[0]];
  }
  return null;
}

export function getEmitenSummaryStatsLocal(limit: number = 5) {
  loadFromDisk();
  const data = memoryStore.stockQueries.filter((q) => q.status === 'success');
  const emitenGroups: Record<string, any[]> = {};

  data.forEach((record) => {
    const sym = record.emiten?.toUpperCase();
    if (!sym) return;
    if (!emitenGroups[sym]) {
      emitenGroups[sym] = [];
    }
    if (emitenGroups[sym].length < limit) {
      emitenGroups[sym].push(record);
    }
  });

  const stats = Object.entries(emitenGroups).map(([emiten, records]) => {
    const tradingDays = records.length;
    let hitR1 = 0;
    let hitMax = 0;
    const sector = records[0]?.sector;
    const bandarCounts: Record<string, number> = {};

    records.forEach((r) => {
      if (r.max_harga && r.target_realistis && r.max_harga >= r.target_realistis) {
        hitR1++;
      }
      if (r.max_harga && r.target_max && r.max_harga >= r.target_max) {
        hitMax++;
      }
      if (r.bandar) {
        bandarCounts[r.bandar] = (bandarCounts[r.bandar] || 0) + 1;
      }
    });

    const topBandars = Object.entries(bandarCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    const hitRateR1 = tradingDays > 0 ? (hitR1 / tradingDays) * 100 : 0;
    const hitRateMax = tradingDays > 0 ? (hitMax / tradingDays) * 100 : 0;
    const totalHitRate = (hitRateR1 + hitRateMax) / 2;

    return {
      emiten,
      sector,
      tradingDays,
      hitR1,
      hitMax,
      hitRateR1,
      hitRateMax,
      totalHitRate,
      topBandars,
    };
  });

  return stats.sort((a, b) => b.totalHitRate - a.totalHitRate);
}

export function hasWatchlistCacheLocal(): boolean {
  loadFromDisk();
  return memoryStore.watchlistGroups.length > 0;
}

export function getCachedWatchlistGroupsLocal(): { groups: WatchlistGroup[]; synced_at: string | null } {
  loadFromDisk();
  return {
    groups: memoryStore.watchlistGroups,
    synced_at: memoryStore.watchlistGroupSyncTime,
  };
}

export function saveCachedWatchlistGroupsLocal(groups: WatchlistGroup[]) {
  loadFromDisk();
  memoryStore.watchlistGroups = [...groups];
  memoryStore.watchlistGroupSyncTime = new Date().toISOString();
  saveToDisk();
}

export function getCachedWatchlistItemsLocal(watchlistId: number): { items: any[]; synced_at: string | null } {
  loadFromDisk();
  const key = String(watchlistId);
  return {
    items: memoryStore.watchlistItems[key] || [],
    synced_at: memoryStore.watchlistItemsSyncTime[key] || null,
  };
}

export function saveCachedWatchlistItemsLocal(watchlistId: number, items: any[]) {
  loadFromDisk();
  const key = String(watchlistId);
  memoryStore.watchlistItems[key] = [...items];
  memoryStore.watchlistItemsSyncTime[key] = new Date().toISOString();
  saveToDisk();
}

export function deleteCachedWatchlistItemLocal(watchlistId: number, symbol: string) {
  loadFromDisk();
  const key = String(watchlistId);
  const existing = memoryStore.watchlistItems[key] || [];
  memoryStore.watchlistItems[key] = existing.filter(
    (i) => (i.symbol || i.company_code || '').toUpperCase() !== symbol.toUpperCase()
  );
  saveToDisk();
}

export function getEmitenFlagLocal(emiten: string): string | null {
  loadFromDisk();
  return memoryStore.emitenFlags[emiten.trim().toUpperCase()] || null;
}

export function setEmitenFlagLocal(emiten: string, flag: string) {
  loadFromDisk();
  const upper = emiten.trim().toUpperCase();
  memoryStore.emitenFlags[upper] = flag;
  saveToDisk();
  return { emiten: upper, flag, updated_at: new Date().toISOString() };
}

export function getEmitenFlagsLocal(emitens: string[]): Map<string, string> {
  loadFromDisk();
  const map = new Map<string, string>();
  for (const e of emitens) {
    const upper = e.trim().toUpperCase();
    const f = memoryStore.emitenFlags[upper];
    if (f) map.set(upper, f);
  }
  return map;
}

export function getProfileSettingLocal(key: string): string | null {
  loadFromDisk();
  return memoryStore.profileSettings[key] || null;
}

export function setProfileSettingLocal(key: string, value: string) {
  loadFromDisk();
  memoryStore.profileSettings[key] = value;
  saveToDisk();
  return { key, value, updated_at: new Date().toISOString() };
}

export function getSessionValueLocal(key: string): string | null {
  loadFromDisk();
  return memoryStore.sessions[key]?.value || null;
}

export function upsertSessionLocal(key: string, value: string, expiresAt?: Date) {
  loadFromDisk();
  const item = {
    key,
    value,
    updated_at: new Date().toISOString(),
    expires_at: expiresAt?.toISOString() || null,
    is_valid: true,
    last_used_at: new Date().toISOString(),
  };
  memoryStore.sessions[key] = item;
  saveToDisk();
  return [item];
}

export const inMemoryStories = memoryStore.stories;
export const inMemoryJobLogs = memoryStore.jobLogs;
