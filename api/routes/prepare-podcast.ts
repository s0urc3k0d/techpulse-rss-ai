import { Router } from 'express';
import { getProviderConfig, getApiKey, getProviderInfo } from '../utils/aiProvider.js';

const router = Router();

interface PreparedArticle {
  url: string;
  title: string;
  catchyTitle: string;
  bulletPoints: string[];
  summary: string;
  error?: string;
}

// Fetch article content from URL
async function fetchArticleContent(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || 'Sans titre';

    // Extract main content (simplified extraction)
    // Remove scripts, styles, and HTML tags
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Get meta description as fallback
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    const metaDesc = ogDescMatch?.[1] || descMatch?.[1] || '';

    // Limit content length
    content = content.substring(0, 5000);
    
    if (metaDesc && content.length < 500) {
      content = metaDesc + ' ' + content;
    }

    return { title: title.trim(), content };
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

router.post('/', async (req, res, next) => {
  try {
    const { urls } = req.body;

    // Validation
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Invalid URLs array' });
    }

    if (urls.length > 20) {
      return res.status(400).json({ error: 'Too many URLs (max 20 per request)' });
    }

    console.log(`📝 Preparing podcast for ${urls.length} articles with ${getProviderInfo()}...`);

    const results: PreparedArticle[] = [];

    // Process each URL
    for (const url of urls) {
      const trimmedUrl = url.trim();
      if (!trimmedUrl || !trimmedUrl.startsWith('http')) {
        results.push({
          url: trimmedUrl,
          title: '',
          catchyTitle: '',
          bulletPoints: [],
          summary: '',
          error: 'URL invalide'
        });
        continue;
      }

      console.log(`  📰 Fetching: ${trimmedUrl}`);
      const articleData = await fetchArticleContent(trimmedUrl);

      if (!articleData) {
        results.push({
          url: trimmedUrl,
          title: '',
          catchyTitle: '',
          bulletPoints: [],
          summary: '',
          error: 'Impossible de récupérer l\'article'
        });
        continue;
      }

      // Generate AI summary
      const prompt = `Tu es un préparateur de podcast tech francophone. Analyse cet article et génère un résumé structuré pour le présenter dans un podcast.

Article:
Titre: ${articleData.title}
Contenu: ${articleData.content.substring(0, 3000)}

Génère un JSON avec:
- "catchyTitle": Un titre court, percutant et accrocheur (max 10 mots) qui donnera envie d'écouter
- "bulletPoints": Exactement 3 points clés importants à retenir (phrases courtes et impactantes)
- "summary": Un résumé de 2-3 phrases pour présenter l'article à l'oral dans le podcast

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide:
{
  "catchyTitle": "...",
  "bulletPoints": ["...", "...", "..."],
  "summary": "..."
}`;

      try {
        const config = getProviderConfig();
        const apiKey = getApiKey(config.provider);
        let responseText: string;

        if (config.provider === 'mistral') {
          const { Mistral } = await import('@mistralai/mistralai');
          const client = new Mistral({ apiKey });

          const response = await client.chat.complete({
            model: config.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            responseFormat: { type: 'json_object' }
          });

          responseText = response.choices?.[0]?.message?.content as string || '{}';
        } else {
          const { GoogleGenAI } = await import('@google/genai');
          const genAI = new GoogleGenAI({ apiKey });

          const response = await genAI.models.generateContent({
            model: config.model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.7
            }
          });

          responseText = response.text || '{}';
        }

        const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleanedResponse);

        results.push({
          url: trimmedUrl,
          title: articleData.title,
          catchyTitle: parsed.catchyTitle || articleData.title,
          bulletPoints: parsed.bulletPoints || [],
          summary: parsed.summary || ''
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (aiError) {
        console.error(`AI error for ${trimmedUrl}:`, aiError);
        results.push({
          url: trimmedUrl,
          title: articleData.title,
          catchyTitle: articleData.title,
          bulletPoints: [],
          summary: '',
          error: 'Erreur lors de l\'analyse IA'
        });
      }
    }

    console.log(`✅ Prepared ${results.filter(r => !r.error).length}/${urls.length} articles successfully`);

    res.json({
      success: true,
      articles: results,
      provider: getProviderInfo()
    });

  } catch (error) {
    console.error('Prepare podcast error:', error);
    next(error);
  }
});

export default router;
