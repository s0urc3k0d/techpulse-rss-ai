/**
 * Feeds Routes - Génération de flux RSS pour export vers blog
 * 
 * Endpoints:
 * - GET /api/feeds/all.xml - Flux RSS global
 * - GET /api/feeds/:category.xml - Flux RSS par catégorie
 * - GET /api/feeds/stats - Statistiques des articles sauvegardés
 * - GET /api/feeds/categories - Liste des catégories disponibles
 * - POST /api/feeds/save - Sauvegarder des articles
 * - DELETE /api/feeds/:id - Supprimer un article
 * - DELETE /api/feeds/clear - Supprimer tous les articles
 */

import { Router } from 'express';
import { XMLParser } from 'fast-xml-parser';
import {
  getAllArticles,
  saveArticles,
  getStats,
  getCategories,
  deleteArticle,
  clearAllArticles,
  slugifyCategory,
  getCategoryFromSlug,
  getAvailableMonths,
  archivePreviousMonth,
  SavedArticle
} from '../utils/feedStorage.js';

const router = Router();

const parseImportedXmlItems = (xmlString: string) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  const parsed = parser.parse(xmlString);
  const rawItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .filter(Boolean)
    .map((item: any) => {
      const title = typeof item.title === 'object' ? item.title['#text'] || '' : (item.title || 'Sans titre');
      const link = item.link?.['@_href'] || item.link || item.guid || '';
      const description = item.description || item.summary || item.content || '';
      const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();
      const source = (typeof item.source === 'object' ? item.source['#text'] : item.source) || 'Imported RSS';

      const rawCategory = item.category;
      const category = Array.isArray(rawCategory)
        ? (typeof rawCategory[0] === 'object' ? rawCategory[0]['#text'] || 'Autre' : rawCategory[0] || 'Autre')
        : (typeof rawCategory === 'object' ? rawCategory?.['#text'] || 'Autre' : rawCategory || 'Autre');

      return {
        title: String(title).trim(),
        link: String(link).trim(),
        description: String(typeof description === 'object' ? description['#text'] || '' : description).trim(),
        source: String(source).trim(),
        pubDate: new Date(pubDate).toISOString(),
        category: String(category).trim() || 'Autre',
      };
    })
    .filter((item: any) => item.title && item.link);
};

/**
 * Génère le XML RSS 2.0 à partir des articles
 */
const generateRSSFeed = (
  articles: SavedArticle[],
  feedTitle: string,
  feedDescription: string,
  feedLink: string
): string => {
  const now = new Date().toUTCString();
  
  const itemsXml = articles.map(article => {
    // Construire le contenu enrichi
    const contentParts: string[] = [];
    
    // Description originale
    if (article.description) {
      contentParts.push(`<p>${escapeXml(article.description)}</p>`);
    }
    
    // Résumé IA
    if (article.summary) {
      contentParts.push(`<h3>📝 Résumé IA</h3><p>${escapeXml(article.summary)}</p>`);
    }
    
    // Points clés
    if (article.keyPoints && article.keyPoints.length > 0) {
      contentParts.push(`<h3>🎯 Points clés</h3><ul>${
        article.keyPoints.map(kp => `<li>${escapeXml(kp)}</li>`).join('')
      }</ul>`);
    }
    
    // Métadonnées
    contentParts.push(`<hr/><p><small>
      <strong>Source:</strong> ${escapeXml(article.source)} | 
      <strong>Catégorie:</strong> ${escapeXml(article.category)} | 
      <strong>Sauvegardé:</strong> ${new Date(article.savedAt).toLocaleDateString('fr-FR')}
    </small></p>`);
    
    const fullContent = contentParts.join('\n');
    
    return `
    <item>
      <title><![CDATA[${article.catchyTitle || article.title}]]></title>
      <link>${escapeXml(article.link)}</link>
      <guid isPermaLink="true">${escapeXml(article.link)}</guid>
      <pubDate>${new Date(article.pubDate).toUTCString()}</pubDate>
      <source url="${escapeXml(article.link)}">${escapeXml(article.source)}</source>
      <category>${escapeXml(article.category)}</category>
      <description><![CDATA[${article.description || ''}]]></description>
      <content:encoded><![CDATA[${fullContent}]]></content:encoded>
      ${article.summary ? `<techpulse:summary><![CDATA[${article.summary}]]></techpulse:summary>` : ''}
      ${article.keyPoints ? `<techpulse:keyPoints><![CDATA[${JSON.stringify(article.keyPoints)}]]></techpulse:keyPoints>` : ''}
      <techpulse:originalTitle><![CDATA[${article.title}]]></techpulse:originalTitle>
      <techpulse:savedAt>${article.savedAt}</techpulse:savedAt>
      <techpulse:savedBy>${article.savedBy}</techpulse:savedBy>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:techpulse="http://techpulse.ai/rss/1.0/">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(feedLink)}</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>fr-FR</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>TechPulse AI RSS Generator</generator>
    <atom:link href="${escapeXml(feedLink)}" rel="self" type="application/rss+xml"/>
    <image>
      <url>https://techpulse.ai/logo.png</url>
      <title>${escapeXml(feedTitle)}</title>
      <link>${escapeXml(feedLink)}</link>
    </image>
    ${itemsXml}
  </channel>
</rss>`;
};

/**
 * Échappe les caractères spéciaux XML
 */
const escapeXml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * GET /api/feeds/stats
 * Statistiques des articles sauvegardés (enrichies avec infos temporelles)
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getStats();
    const categories = getCategories();
    const months = getAvailableMonths();
    
    res.json({
      success: true,
      stats: {
        totalSaved: stats.totalSaved,
        currentMonthCount: stats.currentMonthCount,
        byCategory: stats.byCategory,
        bySource: stats.bySource,
        byMonth: stats.byMonth,
        lastUpdated: stats.lastUpdated
      },
      categories,
      months,
      archives: stats.archives,
      feedUrls: {
        all: '/api/feeds/all.xml',
        byCategory: categories.map(c => ({
          name: c.name,
          url: `/api/feeds/${c.slug}.xml`,
          count: c.count
        })),
        byMonth: months.map(m => ({
          month: m.month,
          url: `/api/feeds/archive/${m.month}.xml`,
          count: m.articleCount,
          isArchived: m.isArchived
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feeds/categories
 * Liste des catégories disponibles
 */
router.get('/categories', (req, res) => {
  try {
    const categories = getCategories();
    res.json({
      success: true,
      categories
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feeds/articles
 * Liste des articles sauvegardés (JSON)
 */
router.get('/articles', (req, res) => {
  try {
    const { category, limit, since, until, month } = req.query;
    
    const options: any = {};
    if (category) options.category = category as string;
    if (limit) options.limit = parseInt(limit as string);
    if (since) options.since = new Date(since as string);
    if (until) options.until = new Date(until as string);
    if (month) options.month = month as string; // YYYY-MM pour archives
    
    const articles = getAllArticles(options);
    
    res.json({
      success: true,
      count: articles.length,
      month: month || 'current',
      articles
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feeds/months
 * Liste des mois disponibles (courant + archives)
 */
router.get('/months', (req, res) => {
  try {
    const months = getAvailableMonths();
    res.json({
      success: true,
      months
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feeds/archive
 * Déclencher l'archivage du mois précédent manuellement
 */
router.post('/archive', (req, res) => {
  try {
    const result = archivePreviousMonth();
    
    if (result) {
      res.json({
        success: true,
        message: `${result.archived} articles archivés pour ${result.month}`,
        ...result
      });
    } else {
      res.json({
        success: true,
        message: 'Aucun article à archiver pour le mois précédent'
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feeds/archive/:month.xml
 * Flux RSS pour un mois spécifique archivé (YYYY-MM)
 */
router.get('/archive/:month.xml', (req, res) => {
  try {
    const { month } = req.params;
    const { limit, category } = req.query;
    
    // Validation format YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).send('<!-- Error: Format de mois invalide (YYYY-MM) -->');
    }
    
    const options: any = { month };
    if (limit) options.limit = parseInt(limit as string);
    if (category) options.category = category as string;
    
    const articles = getAllArticles(options);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // Formatage du mois pour l'affichage
    const [year, monthNum] = month.split('-');
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const monthName = monthNames[parseInt(monthNum) - 1];
    
    const rss = generateRSSFeed(
      articles,
      `TechPulse AI - Archives ${monthName} ${year}`,
      `Flux RSS des articles tech archivés de ${monthName} ${year}`,
      `${baseUrl}/api/feeds/archive/${month}.xml`
    );
    
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600'); // Cache 1 heure (archives)
    res.send(rss);
  } catch (error: any) {
    res.status(500).send(`<!-- Error: ${error.message} -->`);
  }
});

/**
 * GET /api/feeds/all.xml
 * Flux RSS global
 */
router.get('/all.xml', (req, res) => {
  try {
    const { limit, since, until } = req.query;
    
    const options: any = {};
    if (limit) options.limit = parseInt(limit as string);
    if (since) options.since = new Date(since as string);
    if (until) options.until = new Date(until as string);
    
    const articles = getAllArticles(options);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const rss = generateRSSFeed(
      articles,
      'TechPulse AI - Tous les articles',
      'Flux RSS des articles tech sélectionnés et enrichis par IA',
      `${baseUrl}/api/feeds/all.xml`
    );
    
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300'); // Cache 5 minutes
    res.send(rss);
  } catch (error: any) {
    res.status(500).send(`<!-- Error: ${error.message} -->`);
  }
});

/**
 * GET /api/feeds/:category.xml
 * Flux RSS par catégorie
 */
router.get('/:category.xml', (req, res) => {
  try {
    const { category } = req.params;
    const { limit, since, until } = req.query;
    
    // Vérifier que la catégorie existe
    const categoryName = getCategoryFromSlug(category);
    
    const options: any = { category };
    if (limit) options.limit = parseInt(limit as string);
    if (since) options.since = new Date(since as string);
    if (until) options.until = new Date(until as string);
    
    const articles = getAllArticles(options);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    const rss = generateRSSFeed(
      articles,
      `TechPulse AI - ${categoryName || category}`,
      `Flux RSS des articles ${categoryName || category} sélectionnés et enrichis par IA`,
      `${baseUrl}/api/feeds/${category}.xml`
    );
    
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(rss);
  } catch (error: any) {
    res.status(500).send(`<!-- Error: ${error.message} -->`);
  }
});

/**
 * POST /api/feeds/save
 * Sauvegarder des articles pour le flux RSS
 */
router.post('/save', (req, res) => {
  try {
    const { articles, savedBy = 'manual' } = req.body;
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({ error: 'Invalid articles array' });
    }
    
    // Valider et formater les articles
    const formattedArticles = articles.map((a: any) => ({
      title: a.title,
      link: a.link,
      description: a.description || '',
      source: a.source,
      pubDate: a.pubDate || a.isoDate || new Date().toISOString(),
      category: a.category || 'Autre',
      summary: a.summary,
      keyPoints: a.keyPoints,
      catchyTitle: a.catchyTitle,
      savedBy
    }));
    
    const result = saveArticles(formattedArticles, savedBy);
    
    res.json({
      success: true,
      message: `${result.saved} article(s) sauvegardé(s), ${result.duplicates} doublon(s) ignoré(s)`,
      ...result,
      feedUrl: '/api/feeds/all.xml'
    });
  } catch (error: any) {
    console.error('Erreur sauvegarde articles:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feeds/import-xml
 * Importer un ancien flux RSS XML dans le stockage interne
 */
router.post('/import-xml', async (req, res) => {
  try {
    const { xmlContent, xmlUrl, savedBy = 'manual' } = req.body;

    let content: string = xmlContent;
    if (!content && xmlUrl) {
      const response = await fetch(xmlUrl);
      if (!response.ok) {
        return res.status(400).json({ error: `Unable to fetch xmlUrl: HTTP ${response.status}` });
      }
      content = await response.text();
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'xmlContent (string) or xmlUrl is required',
        example: {
          xmlContent: '<?xml version="1.0"...>',
          xmlUrl: 'https://example.com/old-feed.xml'
        }
      });
    }

    const importedArticles = parseImportedXmlItems(content).map(article => ({
      ...article,
      savedBy: savedBy === 'auto' ? 'auto' as const : 'manual' as const
    }));
    if (importedArticles.length === 0) {
      return res.status(400).json({ error: 'No valid items found in XML feed' });
    }

    const result = saveArticles(importedArticles, savedBy === 'auto' ? 'auto' : 'manual');

    res.json({
      success: true,
      imported: importedArticles.length,
      saved: result.saved,
      duplicates: result.duplicates,
      total: result.total,
      feedUrl: '/api/feeds/all.xml'
    });
  } catch (error: any) {
    console.error('Erreur import XML:', error);
    res.status(500).json({ error: error.message || 'XML import failed' });
  }
});

/**
 * DELETE /api/feeds/article/:id
 * Supprimer un article
 */
router.delete('/article/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteArticle(id);
    
    if (deleted) {
      res.json({ success: true, message: 'Article supprimé' });
    } else {
      res.status(404).json({ error: 'Article non trouvé' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/feeds/clear
 * Supprimer tous les articles
 */
router.delete('/clear', (req, res) => {
  try {
    const { confirm } = req.body;
    
    if (confirm !== true) {
      return res.status(400).json({ 
        error: 'Confirmation required',
        hint: 'Send { "confirm": true } to clear all articles'
      });
    }
    
    clearAllArticles();
    res.json({ success: true, message: 'Tous les articles ont été supprimés' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { router as feedsRouter };
