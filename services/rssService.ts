import { RSSItem } from '../types';

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

// Exponential backoff retry helper
const fetchWithRetry = async (
  fetchFn: () => Promise<Response>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetchFn();
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error as Error;
    }
    
    if (i < maxRetries - 1) {
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Helper to fetch using multiple proxies to ensure reliability
const fetchWithBackups = async (url: string, signal?: AbortSignal): Promise<string> => {
  const encodedUrl = encodeURIComponent(url);
  const proxies = [
    {
      name: 'AllOrigins',
      fetch: async () => {
        const res = await fetchWithRetry(
          () => fetch(`https://api.allorigins.win/get?url=${encodedUrl}`, { signal }),
          2
        );
        const data = await res.json();
        if (data.contents) return data.contents;
        throw new Error('No contents in response');
      }
    },
    {
      name: 'CorsProxy',
      fetch: async () => {
        const res = await fetchWithRetry(
          () => fetch(`https://corsproxy.io/?${encodedUrl}`, { signal }),
          2
        );
        const text = await res.text();
        if (text && text.trim().length > 0) return text;
        throw new Error('Empty response');
      }
    }
  ];

  let lastError: Error;
  for (const proxy of proxies) {
    try {
      return await proxy.fetch();
    } catch (e) {
      lastError = e as Error;
      console.warn(`${proxy.name} proxy failed for ${url}:`, e);
    }
  }

  throw lastError! || new Error(`Failed to fetch ${url} via all available proxies`);
};

// Generate hash for deduplication
const generateArticleHash = (title: string, link: string): string => {
  const str = `${title.toLowerCase().trim()}::${link.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

export const fetchAndParseRSS = async (url: string, timeout = 10000): Promise<RSSItem[]> => {
  // Check cache first
  const cached = getCachedData(url);
  if (cached) {
    console.log(`Using cached data for ${url}`);
    return cached;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const xmlContent = await fetchWithBackups(url, controller.signal);
    clearTimeout(timeoutId);

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
    
    // Check for XML parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.warn(`XML Parsing Error for ${url}: ${parserError.textContent}`);
      return [];
    }
    
    // Support both RSS <item> and Atom <entry>
    const items = Array.from(xmlDoc.querySelectorAll("item, entry"));
    
    // Fallback for channel title (RSS vs Atom)
    const channelTitle = xmlDoc.querySelector("channel > title, feed > title")?.textContent || new URL(url).hostname;

    const articles = items.map((item) => {
      const title = item.querySelector("title")?.textContent || "Sans titre";
      
      // RSS <link>text</link> vs Atom <link href="" />
      let link = item.querySelector("link")?.textContent || "";
      if (!link) {
        const linkNode = item.querySelector("link[href]");
        if (linkNode) link = linkNode.getAttribute("href") || "";
      }

      // Date fields can vary (pubDate, published, updated)
      const pubDate = item.querySelector("pubDate, published, updated")?.textContent || "";
      
      // Description/Content fields
      const description = item.querySelector("description, summary, content")?.textContent || 
                          item.getElementsByTagNameNS("*", "encoded")[0]?.textContent || 
                          "";
      
      // Attempt to parse date
      const isoDate = new Date(pubDate);

      return {
        title,
        link,
        pubDate,
        description: cleanDescription(description),
        source: channelTitle,
        isoDate: isNaN(isoDate.getTime()) ? new Date() : isoDate
      };
    });

    // Cache the results
    setCachedData(url, articles);
    
    return articles;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.error(`Timeout fetching RSS feed ${url}`);
    } else {
      console.error(`Error fetching RSS feed ${url}:`, error);
    }
    return [];
  }
};

// Fetch multiple RSS feeds concurrently with controlled concurrency
export const fetchMultipleRSS = async (
  urls: string[],
  onProgress?: (fetched: number, total: number) => void,
  concurrency = 4
): Promise<RSSItem[]> => {
  const allItems: RSSItem[] = [];
  const seenHashes = new Set<string>();
  let completed = 0;

  // Process URLs in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(url => fetchAndParseRSS(url))
    );

    results.forEach((result, idx) => {
      completed++;
      if (result.status === 'fulfilled') {
        // Deduplicate articles
        result.value.forEach(article => {
          const hash = generateArticleHash(article.title, article.link);
          if (!seenHashes.has(hash)) {
            seenHashes.add(hash);
            allItems.push(article);
          }
        });
      } else {
        console.error(`Failed to fetch ${batch[idx]}:`, result.reason);
      }
      
      if (onProgress) {
        onProgress(completed, urls.length);
      }
    });
  }

  return allItems;
};

const cleanDescription = (html: string): string => {
  try {
    // Basic HTML strip to get plain text
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  } catch (e) {
    return "";
  }
};
