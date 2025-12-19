import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { LRUCache, generateCacheKey } from '../utils/cache.js';

const router = Router();

// Initialize cache (50 entries, 24h TTL)
const scriptCache = new LRUCache<any>(50, 24 * 60 * 60 * 1000);

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey });
};

router.post('/', async (req, res, next) => {
  try {
    const { articles } = req.body;

    // Validation
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'Invalid articles array' });
    }

    if (articles.length > 50) {
      return res.status(400).json({ error: 'Too many articles (max 50 per request)' });
    }

    // Check cache first
    const cacheKey = generateCacheKey(articles.map((a: any) => a.id));
    const cached = scriptCache.get(cacheKey);
    
    if (cached) {
      console.log('Cache hit for podcast script');
      return res.json({
        success: true,
        scriptItems: cached,
        cached: true
      });
    }

    const ai = getClient();

    const contentToAnalyze = articles.map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      source: a.source
    }));

    const prompt = `
      You are a professional Tech Podcast Host. 
      I will provide a list of news articles. 
      For EACH article, I need two things in French (Français):
      1. A "Catchy Title" (Titre accrocheur) that sounds great when spoken, to introduce the topic.
      2. A list of 3-4 "Key Points" (Points clés) summarizing the essential information for the listener.
      
      Output strictly valid JSON.
    `;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        scriptItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalId: { type: Type.STRING },
              catchyTitle: { type: Type.STRING, description: "A catchy hook title in French for a podcast" },
              keyPoints: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "3-4 bullet points summarizing the article in French"
              }
            },
            required: ["originalId", "catchyTitle", "keyPoints"]
          }
        }
      },
      required: ["scriptItems"]
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        { role: "user", parts: [{ text: prompt }] },
        { role: "user", parts: [{ text: JSON.stringify(contentToAnalyze) }] }
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

    const parsed = JSON.parse(resultText);
    const scriptItems = parsed.scriptItems || [];
    
    // Cache the result
    scriptCache.set(cacheKey, scriptItems);
    
    res.json({
      success: true,
      scriptItems,
      cached: false
    });

  } catch (error: any) {
    console.error('Podcast script generation error:', error);
    next(error);
  }
});

export { router as generateScriptRouter };
