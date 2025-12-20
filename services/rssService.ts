import { RSSItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Cache management
const RSS_CACHE_KEY = 'rss_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  data: RSSItem[];
  timestamp: number;
  url: string;
}

// Get cached data if valid
const getCachedData = (url: string): RSSItem[] | null => {
  try {
    const cached = localStorage.getItem(`${RSS_CACHE_KEY}_${btoa(url)}`);
    if (!cached) return null;
    
    const entry: CacheEntry = JSON.parse(cached);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(`${RSS_CACHE_KEY}_${btoa(url)}`);
      return null;
    }
    
    return entry.data.map(item => ({
      ...item,
      isoDate: new Date(item.isoDate)
    }));
  } catch (e) {
    return null;
  }
};

// Set cache data
const setCachedData = (url: string, data: RSSItem[]): void => {
  try {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      url
    };
    localStorage.setItem(`${RSS_CACHE_KEY}_${btoa(url)}`, JSON.stringify(entry));
  } catch (e) {
    console.warn('Failed to cache RSS data:', e);
  }
};

/**
 * Fetch RSS feeds via backend API to avoid CORS issues
 */
export const fetchAndParseRSS = async (feedUrls: string[]): Promise<RSSItem[]> => {
  // Check cache first for all feeds
  const allCachedItems: RSSItem[] = [];
  const uncachedUrls: string[] = [];

  for (const url of feedUrls) {
    const cached = getCachedData(url);
    if (cached) {
      allCachedItems.push(...cached);
    } else {
      uncachedUrls.push(url);
    }
  }

  // If all feeds are cached, return immediately
  if (uncachedUrls.length === 0) {
    console.log('All feeds loaded from cache');
    return allCachedItems;
  }

  try {
    console.log(`Fetching ${uncachedUrls.length} RSS feeds via backend...`);
    
    const response = await fetch(`${API_BASE_URL}/rss/fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ feeds: uncachedUrls })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch RSS feeds');
    }

    // Convert isoDate strings back to Date objects
    const items: RSSItem[] = data.items.map((item: any) => ({
      ...item,
      isoDate: new Date(item.isoDate)
    }));

    // Cache the results by source
    const itemsBySource = new Map<string, RSSItem[]>();
    items.forEach(item => {
      const source = item.source;
      if (!itemsBySource.has(source)) {
        itemsBySource.set(source, []);
      }
      itemsBySource.get(source)!.push(item);
    });

    // Find matching URL for each source and cache
    uncachedUrls.forEach(url => {
      const hostname = new URL(url).hostname;
      const sourceItems = items.filter(item => item.source === hostname);
      if (sourceItems.length > 0) {
        setCachedData(url, sourceItems);
      }
    });

    console.log(`Fetched ${items.length} items from ${data.stats.successfulFeeds} feeds`);
    if (data.errors && data.errors.length > 0) {
      console.warn('Some feeds failed:', data.errors);
    }

    // Combine cached and fresh items
    return [...allCachedItems, ...items];

  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    // Return cached items if available, even if fetch failed
    if (allCachedItems.length > 0) {
      console.log('Using cached data due to fetch error');
      return allCachedItems;
    }
    throw error;
  }
};
