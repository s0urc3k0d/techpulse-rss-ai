import { Router } from 'express';
import { XMLParser } from 'fast-xml-parser';

const router = Router();

interface RSSFeed {
  url: string;
}

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  isoDate: Date;
  source: string;
}

/**
 * Parse RSS feed from XML string
 */
const parseRSSFeed = (xmlString: string, sourceUrl: string): RSSItem[] => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  const result = parser.parse(xmlString);
  const items: any[] = result?.rss?.channel?.item || result?.feed?.entry || [];
  
  if (!Array.isArray(items)) {
    return [items].filter(Boolean);
  }

  return items.map((item: any) => {
    // Handle both RSS and Atom formats
    const title = item.title?.['#text'] || item.title || '';
    const link = item.link?.['@_href'] || item.link || '';
    const description = item.description || item.summary || item.content || '';
    const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();

    return {
      title: typeof title === 'string' ? title : String(title),
      link: typeof link === 'string' ? link : String(link),
      description: typeof description === 'string' ? description : String(description),
      pubDate: typeof pubDate === 'string' ? pubDate : String(pubDate),
      isoDate: new Date(pubDate),
      source: new URL(sourceUrl).hostname
    };
  });
};

/**
 * Fetch RSS feed via HTTP
 */
const fetchRSSFeed = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TechPulse RSS Reader/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
};

/**
 * POST /api/rss/fetch
 * Fetch and parse RSS feeds server-side to avoid CORS issues
 */
router.post('/fetch', async (req, res, next) => {
  try {
    const { feeds } = req.body;

    if (!feeds || !Array.isArray(feeds) || feeds.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid feeds array' 
      });
    }

    if (feeds.length > 20) {
      return res.status(400).json({ 
        success: false,
        error: 'Too many feeds (max 20 per request)' 
      });
    }

    const results = await Promise.allSettled(
      feeds.map(async (feedUrl: string) => {
        const xmlContent = await fetchRSSFeed(feedUrl);
        const items = parseRSSFeed(xmlContent, feedUrl);
        return { url: feedUrl, items, success: true };
      })
    );

    const successfulFeeds = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    const failedFeeds = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result, index) => ({
        url: feeds[index],
        error: result.reason?.message || 'Unknown error'
      }));

    const allItems = successfulFeeds.flatMap(feed => feed.items);

    res.json({
      success: true,
      items: allItems,
      stats: {
        totalFeeds: feeds.length,
        successfulFeeds: successfulFeeds.length,
        failedFeeds: failedFeeds.length,
        totalItems: allItems.length
      },
      errors: failedFeeds.length > 0 ? failedFeeds : undefined
    });

  } catch (error) {
    next(error);
  }
});

export { router as rssRouter };
