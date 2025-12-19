// localStorage utilities for app state persistence

const STORAGE_KEYS = {
  FEEDS: 'techpulse_feeds',
  DATE_RANGE: 'techpulse_date_range',
  SELECTED_TAG: 'techpulse_selected_tag',
  LAST_RUN: 'techpulse_last_run'
};

export interface StoredDateRange {
  startDate: string;
  endDate: string;
}

// Feeds persistence
export const loadFeeds = (): string[] | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FEEDS);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.error('Failed to load feeds:', e);
    return null;
  }
};

export const saveFeeds = (feeds: string[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(feeds));
  } catch (e) {
    console.error('Failed to save feeds:', e);
  }
};

// Date range persistence
export const loadDateRange = (): StoredDateRange | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DATE_RANGE);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.error('Failed to load date range:', e);
    return null;
  }
};

export const saveDateRange = (startDate: string, endDate: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.DATE_RANGE, JSON.stringify({ startDate, endDate }));
  } catch (e) {
    console.error('Failed to save date range:', e);
  }
};

// Selected tag persistence
export const loadSelectedTag = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_TAG);
  } catch (e) {
    console.error('Failed to load selected tag:', e);
    return null;
  }
};

export const saveSelectedTag = (tag: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SELECTED_TAG, tag);
  } catch (e) {
    console.error('Failed to save selected tag:', e);
  }
};

// Export/Import configuration
export interface AppConfig {
  feeds: string[];
  dateRange: StoredDateRange;
  selectedTag: string;
}

export const exportConfig = (): string => {
  const config: AppConfig = {
    feeds: loadFeeds() || [],
    dateRange: loadDateRange() || { startDate: '', endDate: '' },
    selectedTag: loadSelectedTag() || 'All'
  };
  return JSON.stringify(config, null, 2);
};

export const importConfig = (jsonString: string): boolean => {
  try {
    const config: AppConfig = JSON.parse(jsonString);
    if (config.feeds) saveFeeds(config.feeds);
    if (config.dateRange) saveDateRange(config.dateRange.startDate, config.dateRange.endDate);
    if (config.selectedTag) saveSelectedTag(config.selectedTag);
    return true;
  } catch (e) {
    console.error('Failed to import config:', e);
    return false;
  }
};

// Clear all app data
export const clearAllData = (): void => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};
