import { describe, it, expect, beforeEach } from 'vitest';
import { 
  saveFeeds, 
  loadFeeds, 
  saveDateRange, 
  loadDateRange,
  exportConfig,
  importConfig,
  clearAllData 
} from '../services/storageService';

describe('storageService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Feeds persistence', () => {
    it('should save and load feeds', () => {
      const feeds = ['https://example.com/feed1', 'https://example.com/feed2'];
      saveFeeds(feeds);
      
      const loaded = loadFeeds();
      expect(loaded).toEqual(feeds);
    });

    it('should return null for non-existent feeds', () => {
      const loaded = loadFeeds();
      expect(loaded).toBeNull();
    });
  });

  describe('Date range persistence', () => {
    it('should save and load date range', () => {
      const startDate = '2025-01-01';
      const endDate = '2025-01-31';
      
      saveDateRange(startDate, endDate);
      const loaded = loadDateRange();
      
      expect(loaded).toEqual({ startDate, endDate });
    });

    it('should return null for non-existent date range', () => {
      const loaded = loadDateRange();
      expect(loaded).toBeNull();
    });
  });

  describe('Config export/import', () => {
    it('should export current configuration', () => {
      const feeds = ['https://example.com/feed'];
      saveFeeds(feeds);
      saveDateRange('2025-01-01', '2025-01-31');
      
      const exported = exportConfig();
      const parsed = JSON.parse(exported);
      
      expect(parsed.feeds).toEqual(feeds);
      expect(parsed.dateRange).toEqual({ startDate: '2025-01-01', endDate: '2025-01-31' });
    });

    it('should import configuration', () => {
      const config = {
        feeds: ['https://imported.com/feed'],
        dateRange: { startDate: '2025-02-01', endDate: '2025-02-28' },
        selectedTag: 'Hardware'
      };
      
      const success = importConfig(JSON.stringify(config));
      expect(success).toBe(true);
      
      const loadedFeeds = loadFeeds();
      expect(loadedFeeds).toEqual(config.feeds);
    });
  });

  describe('Clear all data', () => {
    it('should clear all stored data', () => {
      saveFeeds(['https://example.com/feed']);
      saveDateRange('2025-01-01', '2025-01-31');
      
      clearAllData();
      
      expect(loadFeeds()).toBeNull();
      expect(loadDateRange()).toBeNull();
    });
  });
});
