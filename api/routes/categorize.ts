import { Router } from 'express';
import { categorizeWithAI, getProviderInfo } from '../utils/aiProvider.js';
import { LRUCache, generateCacheKey } from '../utils/cache.js';

const router = Router();

// Initialize cache (100 entries, 24h TTL)
const classificationCache = new LRUCache<any>(100, 24 * 60 * 60 * 1000);

// Process articles in batches using abstracted AI provider
const processBatch = async (articles: Array<{ id: string; title: string; description: string }>) => {
  return categorizeWithAI(articles);
};

router.post('/', async (req, res, next) => {
  try {
    const { articles } = req.body;

    // Validation
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'Invalid articles array' });
    }

    if (articles.length > 200) {
      return res.status(400).json({ error: 'Too many articles (max 200 per request)' });
    }

    // Check cache first
    const cacheKey = generateCacheKey(articles.map((a: any) => a.id));
    const cached = classificationCache.get(cacheKey);
    
    if (cached) {
      console.log(`✅ Cache hit for categorization (${getProviderInfo()})`);
      return res.json({
        success: true,
        classifications: cached,
        cached: true,
        provider: getProviderInfo()
      });
    }

    console.log(`🤖 Categorizing ${articles.length} articles with ${getProviderInfo()}...`);

    // Generate unique IDs for mapping
    const articlesWithId = articles.map((a: any, index: number) => ({
      id: a.id || `art_${index}`,
      title: a.title,
      description: (a.description || '').substring(0, 150)
    }));

    // Process in batches of 20
    const BATCH_SIZE = 20;
    const allClassifications: any[] = [];

    for (let i = 0; i < articlesWithId.length; i += BATCH_SIZE) {
      const batch = articlesWithId.slice(i, i + BATCH_SIZE);
      const batchResult = await processBatch(batch);
      allClassifications.push(...batchResult);
    }

    // Cache the result
    classificationCache.set(cacheKey, allClassifications);
    
    console.log(`✅ Categorized ${allClassifications.length} articles successfully`);

    res.json({
      success: true,
      classifications: allClassifications,
      cached: false,
      provider: getProviderInfo()
    });

  } catch (error: any) {
    console.error('❌ Categorization error:', error.message);
    next(error);
  }
});

export { router as categorizeRouter };
