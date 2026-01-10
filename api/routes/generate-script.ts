import { Router } from 'express';
import { generateScriptWithAI, getProviderInfo } from '../utils/aiProvider.js';
import { LRUCache, generateCacheKey } from '../utils/cache.js';

const router = Router();

// Initialize cache (50 entries, 24h TTL)
const scriptCache = new LRUCache<any>(50, 24 * 60 * 60 * 1000);

router.post('/', async (req, res, next) => {
  try {
    const { articles } = req.body;

    // Validation
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'Invalid articles array' });
    }

    if (articles.length > 100) {
      return res.status(400).json({ error: 'Too many articles (max 100 per request)' });
    }

    // Check cache first
    const cacheKey = generateCacheKey(articles.map((a: any) => a.id));
    const cached = scriptCache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache hit for podcast script (${getProviderInfo()})`);
      return res.json({
        success: true,
        scriptItems: cached,
        cached: true,
        provider: getProviderInfo()
      });
    }

    console.log(`🎙️ Generating podcast script for ${articles.length} articles with ${getProviderInfo()}...`);

    const contentToAnalyze = articles.map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      source: a.source
    }));

    const scriptItems = await generateScriptWithAI(contentToAnalyze);
    
    // Cache the result
    scriptCache.set(cacheKey, scriptItems);
    
    console.log(`✅ Generated ${scriptItems.length} script items successfully`);

    res.json({
      success: true,
      scriptItems,
      cached: false,
      provider: getProviderInfo()
    });

  } catch (error: any) {
    console.error('❌ Podcast script generation error:', error.message);
    next(error);
  }
});

export { router as generateScriptRouter };
