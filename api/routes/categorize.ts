import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { LRUCache, generateCacheKey } from '../utils/cache.js';

const router = Router();

// Initialize cache (100 entries, 24h TTL)
const classificationCache = new LRUCache<any>(100, 24 * 60 * 60 * 1000);

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
};

// Categories enum matching frontend
const Category = {
  HARDWARE: "Hardware",
  GAMING: "Jeux Vidéo",
  AI: "IA & Data",
  SOFTWARE: "Software & Apps",
  SECURITY: "Cybersécurité",
  BUSINESS: "Business Tech",
  MOBILE: "Mobile & Telecom",
  SCIENCE: "Science & Espace",
  OTHER: "Autre"
};

// Process articles in batches
const processBatch = async (articles: any[], ai: any) => {
  const prompt = `
    You are a tech news aggregator assistant. 
    Analyze the following list of tech news articles.
    Assign exactly one category to each article from the following list:
    [Hardware, Jeux Vidéo, IA & Data, Software & Apps, Cybersécurité, Business Tech, Mobile & Telecom, Science & Espace, Autre].
    
    Return a JSON object where the key is the article ID and the value is the category.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      classifications: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            category: { 
              type: Type.STRING,
              enum: Object.values(Category)
            },
          },
          required: ["id", "category"]
        }
      }
    },
    required: ["classifications"]
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp",
    contents: [
      { role: "user", parts: [{ text: prompt }] },
      { role: "user", parts: [{ text: JSON.stringify(articles) }] }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    }
  });

  const resultText = response.text;
  if (!resultText) {
    throw new Error('No response from Gemini');
  }

  return JSON.parse(resultText);
};

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
    const cached = classificationCache.get(cacheKey);
    
    if (cached) {
      console.log('Cache hit for categorization');
      return res.json({
        success: true,
        classifications: cached,
        cached: true
      });
    }

    const ai = getClient();

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
      const batchResult = await processBatch(batch, ai);
      
      if (batchResult.classifications) {
        allClassifications.push(...batchResult.classifications);
      }
    }

    // Cache the result
    classificationCache.set(cacheKey, allClassifications);
    
    res.json({
      success: true,
      classifications: allClassifications,
      cached: false
    });

  } catch (error: any) {
    console.error('Categorization error:', error);
    next(error);
  }
});

export { router as categorizeRouter };
