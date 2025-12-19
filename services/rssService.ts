import { RSSItem } from '../types';

// Helper to fetch using multiple proxies to ensure reliability
const fetchWithBackups = async (url: string): Promise<string> => {
  const encodedUrl = encodeURIComponent(url);
  
  // Strategy 1: AllOrigins (JSON)
  // Good reliability, standard CORS headers
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodedUrl}`);
    if (res.ok) {
      const data = await res.json();
      if (data.contents) return data.contents;
    }
  } catch (e) {
    console.warn(`AllOrigins proxy failed for ${url}`);
  }

  // Strategy 2: CorsProxy.io (Raw)
  // Fast, transparent proxy
  try {
    const res = await fetch(`https://corsproxy.io/?${encodedUrl}`);
    if (res.ok) {
      const text = await res.text();
      // Simple validation to ensure we didn't get an empty response or error page
      if (text && text.trim().length > 0) return text;
    }
  } catch (e) {
    console.warn(`CorsProxy failed for ${url}`);
  }

  throw new Error(`Failed to fetch ${url} via all available proxies`);
};

export const fetchAndParseRSS = async (url: string): Promise<RSSItem[]> => {
  try {
    const xmlContent = await fetchWithBackups(url);

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

    return items.map((item) => {
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
  } catch (error) {
    console.error(`Error fetching RSS feed ${url}:`, error);
    return [];
  }
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
