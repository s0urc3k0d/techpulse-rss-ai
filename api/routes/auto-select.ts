import { Router } from 'express';
import { getProviderConfig, getApiKey, getProviderInfo } from '../utils/aiProvider.js';

const router = Router();

interface ArticleForSelection {
  id: string;
  title: string;
  description: string;
  category: string;
  source: string;
}

router.post('/', async (req, res, next) => {
  try {
    const { articles, maxPerCategory = 5 } = req.body;

    // Validation
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'Invalid articles array' });
    }

    if (articles.length > 500) {
      return res.status(400).json({ error: 'Too many articles (max 500 per request)' });
    }

    console.log(`🎯 Auto-selecting top ${maxPerCategory} articles per category from ${articles.length} articles with ${getProviderInfo()}...`);

    // Group articles by category
    const byCategory: Record<string, ArticleForSelection[]> = {};
    articles.forEach((article: ArticleForSelection) => {
      if (!byCategory[article.category]) {
        byCategory[article.category] = [];
      }
      byCategory[article.category].push(article);
    });

    const categories = Object.keys(byCategory);
    console.log(`📊 Categories found: ${categories.join(', ')}`);

    // Build prompt for AI
    const prompt = `Tu es un expert en veille technologique. Analyse ces articles et sélectionne les ${maxPerCategory} plus importants/intéressants PAR CATÉGORIE pour un podcast tech.

Critères de sélection:
- Impact sur l'industrie tech
- Nouveauté/Innovation
- Intérêt pour un public tech francophone
- Exclusivité de l'information

Articles par catégorie:
${categories.map(cat => {
  const catArticles = byCategory[cat];
  return `\n## ${cat} (${catArticles.length} articles)\n${catArticles.map(a => `- [${a.id}] "${a.title}" (${a.source})`).join('\n')}`;
}).join('\n')}

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide contenant les IDs des articles sélectionnés, groupés par catégorie:
{
  "selections": {
    "Catégorie1": ["id1", "id2", ...],
    "Catégorie2": ["id3", "id4", ...],
    ...
  },
  "reasoning": "Brève explication de tes choix (2-3 phrases)"
}`;

    const config = getProviderConfig();
    const apiKey = getApiKey(config.provider);
    let responseText: string;

    if (config.provider === 'mistral') {
      const { Mistral } = await import('@mistralai/mistralai');
      const client = new Mistral({ apiKey });
      
      const response = await client.chat.complete({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
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
          temperature: 0.3
        }
      });

      responseText = response.text || '{}';
    }

    // Parse response
    const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanedResponse);

    // Flatten all selected IDs
    const allSelectedIds: string[] = [];
    if (parsed.selections) {
      Object.values(parsed.selections).forEach((ids: any) => {
        if (Array.isArray(ids)) {
          allSelectedIds.push(...ids);
        }
      });
    }

    console.log(`✅ Auto-selected ${allSelectedIds.length} articles across ${Object.keys(parsed.selections || {}).length} categories`);

    res.json({
      success: true,
      selectedIds: allSelectedIds,
      selectionsByCategory: parsed.selections || {},
      reasoning: parsed.reasoning || '',
      provider: getProviderInfo()
    });

  } catch (error) {
    console.error('Auto-selection error:', error);
    next(error);
  }
});

export default router;
