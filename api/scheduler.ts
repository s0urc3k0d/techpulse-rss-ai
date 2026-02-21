import cron, { type ScheduledTask } from 'node-cron';
import { XMLParser } from 'fast-xml-parser';
import { categorizeForScheduler, getProviderInfo, getProviderConfig, getApiKey } from './utils/aiProvider.js';
import { 
  createEmailTransporter, 
  sendEmail, 
  generateDailyDigestEmail, 
  generateDailyDigestText,
  generateSaturdayPodcastEmail,
  generateSaturdayPodcastText,
  type PodcastPrepEmailItem
} from './utils/emailService.js';
import { saveArticles, articleExists, archivePreviousMonth } from './utils/feedStorage.js';

// Fetch RSS helper (server-side only)
async function fetchAndParseRSS(url: string): Promise<any[]> {
  const response = await fetch(url);
  const text = await response.text();
  
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });
  
  const result = parser.parse(text);
  
  // Handle different RSS/Atom formats
  const items = result.rss?.channel?.item || result.feed?.entry || [];
  const itemsArray = Array.isArray(items) ? items : [items];
  
  return itemsArray.map((item: any) => {
    const title = item.title || '';
    const link = item.link?.['@_href'] || item.link || '';
    const description = item.description || item.summary || item.content || '';
    const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();
    
    return {
      title: typeof title === 'object' ? title['#text'] || '' : title,
      link: typeof link === 'object' ? link['#text'] || '' : link,
      description: typeof description === 'object' ? description['#text'] || '' : description,
      source: new URL(url).hostname.replace('www.', ''),
      isoDate: new Date(pubDate)
    };
  }).filter((item: any) => item.title && item.link);
}

const DEFAULT_FEEDS = [
  'https://news.ycombinator.com/rss',
  'https://techcrunch.com/feed/',
  'https://www.theverge.com/rss/index.xml',
];

interface SchedulerConfig {
  enabled: boolean;
  cronExpression: string;
  feeds: string[];
  emailTo: string;
}

interface AutoPipelineConfig {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  feeds: string[];
  maxPerCategory: number;
  lookbackHours: number;
  runOnStart: boolean;
}

interface SaturdayPodcastConfig {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  emailTo: string;
  maxPerCategory: number;
  runOnStart: boolean;
  internalApiBaseUrl: string;
}

const STARTUP_WARMUP_SECONDS = Math.max(0, parseInt(process.env.SCHEDULER_STARTUP_WARMUP_SECONDS || (process.env.NODE_ENV === 'production' ? '45' : '5'), 10));

const scheduleRunOnStart = (label: string, job: () => void, additionalDelayMs = 0) => {
  const delayMs = (STARTUP_WARMUP_SECONDS * 1000) + additionalDelayMs;
  console.log(`⏳ [${label}] Exécution différée au démarrage dans ${Math.round(delayMs / 1000)}s`);
  setTimeout(job, delayMs);
};

const logSmtpError = (scope: string, error: any) => {
  const code = error?.code || 'UNKNOWN';
  const response = error?.response || error?.message || 'No response';
  const isAuthError = code === 'EAUTH' || String(response).includes('535');

  if (isAuthError) {
    console.error(`❌ [${scope}] SMTP auth échouée (${code}): ${response}`);
    console.error(`🛠️  [${scope}] Vérifie EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASS/EMAIL_SECURE (mot de passe applicatif si Gmail/Office365).`);
    return;
  }

  console.error(`❌ [${scope}] Erreur email (${code}): ${response}`);
};

interface InternalRssArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  source: string;
  link: string;
  isoDate: Date;
}

const parseFeedsFromEnv = (rawFeeds: string | undefined, fallback: string[]): string[] => {
  if (!rawFeeds) return fallback;
  try {
    const parsed = JSON.parse(rawFeeds);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    console.warn('⚠️  [Scheduler] Invalid feeds JSON in env, using default feeds');
    return fallback;
  }
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const extractText = (value: any): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    return value['#text'] || value['@_href'] || value.href || '';
  }
  return '';
};

const getPreviousSundayStart = (now: Date): Date => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

const fetchInternalRssArticles = async (baseUrl: string): Promise<InternalRssArticle[]> => {
  const response = await fetch(`${baseUrl}/api/feeds/all.xml`, {
    headers: {
      'User-Agent': 'TechPulse Scheduler/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch internal RSS feed: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  const parsed = parser.parse(xml);
  const rawItems = parsed?.rss?.channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .filter(Boolean)
    .map((item: any, index: number) => {
      const title = extractText(item.title);
      const description = extractText(item.description);
      const link = extractText(item.link);
      const category = extractText(item.category) || 'Autre';
      const source = extractText(item.source) || 'Unknown';
      const savedAt = extractText(item['techpulse:savedAt']);
      const pubDate = extractText(item.pubDate);
      const timestamp = savedAt || pubDate || new Date().toISOString();

      return {
        id: `rss_${hashString(link || title)}_${index}`,
        title,
        description,
        category,
        source,
        link,
        isoDate: new Date(timestamp)
      };
    })
    .filter((item: InternalRssArticle) => item.title && item.link && !Number.isNaN(item.isoDate.getTime()));
};

const enrichArticleForPodcastWithMistral = async (article: InternalRssArticle): Promise<PodcastPrepEmailItem> => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY is required for Saturday podcast pipeline');
  }

  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  const { Mistral } = await import('@mistralai/mistralai');
  const client = new Mistral({ apiKey });

  const prompt = `Tu es rédacteur pour un podcast tech francophone. Tu dois transformer cet article en format prêt à l'oral.

Article:
- Titre: ${article.title}
- Catégorie: ${article.category}
- Source: ${article.source}
- Description: ${article.description || 'N/A'}

Réponds uniquement en JSON avec:
{
  "catchyTitle": "Titre percutant et court",
  "bulletPoint": "Un seul point clé (une phrase)",
  "fullSummary": "Résumé complet et fluide en français (4 à 8 phrases)"
}`;

  const response = await client.chat.complete({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.4,
    responseFormat: { type: 'json_object' }
  });

  const content = response.choices?.[0]?.message?.content as string || '{}';
  const parsed = JSON.parse(content);

  return {
    category: article.category,
    originalTitle: article.title,
    catchyTitle: parsed.catchyTitle || article.title,
    bulletPoint: parsed.bulletPoint || 'Point clé non généré.',
    fullSummary: parsed.fullSummary || article.description || 'Résumé indisponible.',
    link: article.link,
    source: article.source,
  };
};

const selectTopArticlesByCategory = async (
  articles: Array<{ id: string; title: string; description: string; category: string; source: string; isoDate: Date; link: string }>,
  maxPerCategory: number
): Promise<{ selectedIds: string[]; reasoning: string; selectionsByCategory: Record<string, string[]> }> => {
  if (articles.length === 0) {
    return { selectedIds: [], reasoning: '', selectionsByCategory: {} };
  }

  const byCategory: Record<string, typeof articles> = {};
  articles.forEach(article => {
    if (!byCategory[article.category]) byCategory[article.category] = [];
    byCategory[article.category].push(article);
  });

  const deterministicFallback = () => {
    const selectionsByCategory: Record<string, string[]> = {};
    Object.entries(byCategory).forEach(([category, items]) => {
      selectionsByCategory[category] = [...items]
        .sort((a, b) => b.isoDate.getTime() - a.isoDate.getTime())
        .slice(0, maxPerCategory)
        .map(item => item.id);
    });

    const selectedIds = Object.values(selectionsByCategory).flat();
    return {
      selectedIds,
      selectionsByCategory,
      reasoning: 'Fallback chronologique appliqué (articles les plus récents par catégorie).'
    };
  };

  try {
    const categories = Object.keys(byCategory);
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
    "Catégorie2": ["id3", "id4", ...]
  },
  "reasoning": "Brève explication de tes choix (2-3 phrases)"
}`;

    const config = getProviderConfig();
    const apiKey = getApiKey(config.provider);
    let responseText = '{}';

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

    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned || '{}');
    const selections = parsed.selections || {};

    const validIds = new Set(articles.map(a => a.id));
    const selectedIds: string[] = [];
    const selectionsByCategory: Record<string, string[]> = {};

    Object.entries(selections).forEach(([category, ids]) => {
      if (!Array.isArray(ids)) return;
      const capped: string[] = [];
      ids.forEach((id: string) => {
        if (capped.length >= maxPerCategory) return;
        if (!validIds.has(id)) return;
        if (selectedIds.includes(id)) return;
        const article = articles.find(a => a.id === id);
        if (!article || article.category !== category) return;

        capped.push(id);
        selectedIds.push(id);
      });

      if (capped.length > 0) {
        selectionsByCategory[category] = capped;
      }
    });

    if (selectedIds.length === 0) {
      return deterministicFallback();
    }

    return {
      selectedIds,
      selectionsByCategory,
      reasoning: parsed.reasoning || 'Sélection IA appliquée.'
    };
  } catch (error) {
    console.warn('⚠️  [AutoSelect] Échec sélection IA, fallback chronologique.', error);
    return deterministicFallback();
  }
};

const runAutomatedBlogFeedPipeline = async (
  feeds: string[],
  maxPerCategory: number,
  lookbackHours: number,
  logPrefix = 'AutoPipeline'
): Promise<{ saved: number; duplicates: number; selected: number; totalCategorized: number }> => {
  console.log(`🚀 [${logPrefix}] Démarrage pipeline automatique (${feeds.length} flux, top ${maxPerCategory}/catégorie)`);

  const allItems: any[] = [];
  for (const feedUrl of feeds) {
    try {
      const items = await fetchAndParseRSS(feedUrl);
      const newItems = items.filter((item: any) => !articleExists(item.link));
      allItems.push(...newItems);
      console.log(`✅ [${logPrefix}] ${newItems.length} nouveaux articles depuis ${feedUrl}`);
    } catch (error) {
      console.error(`❌ [${logPrefix}] Erreur flux ${feedUrl}:`, error);
    }
  }

  if (allItems.length === 0) {
    console.log(`⚠️  [${logPrefix}] Aucun nouvel article à traiter`);
    return { saved: 0, duplicates: 0, selected: 0, totalCategorized: 0 };
  }

  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - lookbackHours);
  const recentArticles = allItems.filter(item => item.isoDate >= windowStart);

  if (recentArticles.length === 0) {
    console.log(`⚠️  [${logPrefix}] Aucun article dans la fenêtre ${lookbackHours}h`);
    return { saved: 0, duplicates: 0, selected: 0, totalCategorized: 0 };
  }

  console.log(`🤖 [${logPrefix}] Catégorisation IA de ${recentArticles.length} articles avec ${getProviderInfo()}...`);
  const categorized: Array<{ id: string; title: string; link: string; description: string; source: string; isoDate: Date; category: string }> = [];
  const batchSize = 20;

  for (let i = 0; i < recentArticles.length; i += batchSize) {
    const batch = recentArticles.slice(i, i + batchSize);
    try {
      const categories = await categorizeForScheduler(batch);
      batch.forEach((article: any, idx: number) => {
        categorized.push({
          ...article,
          id: `sched_${hashString(article.link || article.title)}_${i + idx}`,
          category: categories[idx]?.category || 'Autre',
        });
      });
    } catch (error) {
      console.error(`❌ [${logPrefix}] Erreur catégorisation batch:`, error);
      batch.forEach((article: any, idx: number) => {
        categorized.push({
          ...article,
          id: `sched_${hashString(article.link || article.title)}_${i + idx}`,
          category: 'Autre',
        });
      });
    }
  }

  const selection = await selectTopArticlesByCategory(categorized, maxPerCategory);
  const selectedArticles = categorized.filter(article => selection.selectedIds.includes(article.id));

  if (selectedArticles.length === 0) {
    console.log(`⚠️  [${logPrefix}] Auto-sélection vide, rien à sauvegarder`);
    return { saved: 0, duplicates: 0, selected: 0, totalCategorized: categorized.length };
  }

  console.log(`🎯 [${logPrefix}] ${selectedArticles.length} articles sélectionnés (${selection.reasoning})`);

  const articlesToSave = selectedArticles.map(article => ({
    title: article.title,
    link: article.link,
    description: article.description || '',
    source: article.source,
    pubDate: article.isoDate.toISOString(),
    category: article.category,
    savedBy: 'auto' as const,
  }));

  const saveResult = saveArticles(articlesToSave, 'auto');
  console.log(`✅ [${logPrefix}] ${saveResult.saved} articles sauvegardés, ${saveResult.duplicates} doublons ignorés`);

  return {
    saved: saveResult.saved,
    duplicates: saveResult.duplicates,
    selected: selectedArticles.length,
    totalCategorized: categorized.length,
  };
};

const runSaturdayPodcastPipeline = async (config: SaturdayPodcastConfig): Promise<void> => {
  console.log('🎙️ [SaturdayPodcast] Démarrage du pipeline podcast hebdomadaire...');

  try {
    if (!config.emailTo) {
      console.warn('⚠️  [SaturdayPodcast] Adresse email manquante, abandon');
      return;
    }

    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn('⚠️  [SaturdayPodcast] Configuration SMTP manquante, abandon');
      return;
    }

    const now = new Date();
    const windowStart = getPreviousSundayStart(now);

    const rssArticles = await fetchInternalRssArticles(config.internalApiBaseUrl);
    const candidateArticles = rssArticles.filter(article => article.isoDate >= windowStart && article.isoDate <= now);

    console.log(`📰 [SaturdayPodcast] ${candidateArticles.length} articles trouvés entre ${windowStart.toISOString()} et ${now.toISOString()}`);

    if (candidateArticles.length === 0) {
      console.log('⚠️  [SaturdayPodcast] Aucun article sur la période, email non envoyé');
      return;
    }

    const selection = await selectTopArticlesByCategory(candidateArticles, config.maxPerCategory);
    const selectedArticles = candidateArticles.filter(article => selection.selectedIds.includes(article.id));

    if (selectedArticles.length === 0) {
      console.log('⚠️  [SaturdayPodcast] Aucun article sélectionné, email non envoyé');
      return;
    }

    console.log(`🎯 [SaturdayPodcast] ${selectedArticles.length} articles sélectionnés (${selection.reasoning})`);

    const preparedItems: PodcastPrepEmailItem[] = [];
    for (const article of selectedArticles) {
      try {
        const enriched = await enrichArticleForPodcastWithMistral(article);
        preparedItems.push(enriched);
      } catch (error) {
        console.error(`❌ [SaturdayPodcast] Échec enrichissement Mistral pour: ${article.title}`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (preparedItems.length === 0) {
      console.log('⚠️  [SaturdayPodcast] Aucun contenu enrichi, email non envoyé');
      return;
    }

    const transporter = createEmailTransporter({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const html = generateSaturdayPodcastEmail(preparedItems, {
      windowStart,
      generatedAt: now,
    });
    const text = generateSaturdayPodcastText(preparedItems, {
      windowStart,
      generatedAt: now,
    });

    try {
      await sendEmail(transporter, {
        to: config.emailTo,
        subject: `🎙️ TechPulse Podcast Samedi - ${now.toLocaleDateString('fr-FR')}`,
        html,
        text,
      });

      console.log(`✅ [SaturdayPodcast] Email envoyé avec ${preparedItems.length} sujets`);
    } catch (error) {
      logSmtpError('SaturdayPodcast', error);
    }
  } catch (error) {
    console.error('❌ [SaturdayPodcast] Erreur pipeline:', error);
  }
};

/**
 * Run daily scraping job
 */
const runDailyScraping = async (config: SchedulerConfig) => {
  console.log('🚀 [Scheduler] Démarrage du scraping quotidien...');
  
  try {
    // 1. Fetch RSS feeds
    console.log(`📡 [Scheduler] Récupération de ${config.feeds.length} flux RSS...`);
    const allItems: any[] = [];
    
    for (const feedUrl of config.feeds) {
      try {
        const items = await fetchAndParseRSS(feedUrl);
        allItems.push(...items);
        console.log(`✅ [Scheduler] ${items.length} articles depuis ${feedUrl}`);
      } catch (error) {
        console.error(`❌ [Scheduler] Erreur flux ${feedUrl}:`, error);
      }
    }

    if (allItems.length === 0) {
      console.log('⚠️  [Scheduler] Aucun article récupéré, abandon.');
      return;
    }

    // 2. Filter articles from last 24h (exactly 24 hours back from now)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const recentArticles = allItems.filter(item => item.isoDate >= last24Hours);
    console.log(`📅 [Scheduler] ${recentArticles.length} articles des dernières 24h (depuis ${last24Hours.toLocaleString('fr-FR')})`);

    if (recentArticles.length === 0) {
      console.log('⚠️  [Scheduler] Aucun article récent, abandon.');
      return;
    }

    // 3. Categorize with AI using abstracted provider
    console.log(`🤖 [Scheduler] Catégorisation IA en cours avec ${getProviderInfo()}...`);
    
    const categorized: any[] = [];
    const batchSize = 20;
    
    for (let i = 0; i < recentArticles.length; i += batchSize) {
      const batch = recentArticles.slice(i, i + batchSize);
      
      try {
        const categories = await categorizeForScheduler(batch);
        
        batch.forEach((article: any, idx: number) => {
          categorized.push({
            ...article,
            category: categories[idx]?.category || 'Autre',
            id: `${article.source}-${article.title}`.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 50)
          });
        });
      } catch (error) {
        console.error('❌ Erreur catégorisation batch:', error);
        // Fallback: add articles without categories
        batch.forEach((article: any) => {
          categorized.push({
            ...article,
            category: 'Autre',
            id: `${article.source}-${article.title}`.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 50)
          });
        });
      }
    }
    
    console.log(`✅ [Scheduler] ${categorized.length} articles catégorisés`);

    // 4. Generate statistics
    const stats = {
      totalArticles: categorized.length,
      byCategory: categorized.reduce((acc: Record<string, number>, a: any) => {
        acc[a.category] = (acc[a.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      topSources: Object.entries(
        categorized.reduce((acc: Record<string, number>, a: any) => {
          acc[a.source] = (acc[a.source] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      )
        .map(([name, count]) => ({ name, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    };

    // 5. Save to Blog Feed (if enabled)
    if (process.env.BLOG_FEED_AUTO_SAVE === 'true') {
      console.log('📝 [Scheduler] Sauvegarde automatique dans le flux Blog...');
      
      // Filter out duplicates before saving
      const newArticles = categorized.filter((a: any) => !articleExists(a.link));
      
      if (newArticles.length > 0) {
        const articlesToSave = newArticles.map((a: any) => ({
          title: a.title,
          link: a.link,
          description: a.description || '',
          source: a.source,
          pubDate: a.isoDate.toISOString(),
          category: a.category,
          savedBy: 'auto' as const
        }));
        
        const saveResult = saveArticles(articlesToSave, 'auto');
        console.log(`✅ [Scheduler] Blog Feed: ${saveResult.saved} articles sauvegardés, ${saveResult.duplicates} doublons ignorés`);
      } else {
        console.log('⚠️  [Scheduler] Blog Feed: Aucun nouvel article à sauvegarder');
      }
    }

    // 6. Send email
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('⚠️  [Scheduler] Configuration email manquante, email non envoyé.');
      console.log(`📊 [Scheduler] Stats: ${stats.totalArticles} articles, ${Object.keys(stats.byCategory).length} catégories`);
      return;
    }

    const transporter = createEmailTransporter({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const emailHtml = generateDailyDigestEmail(categorized, stats);
    const emailText = generateDailyDigestText(categorized, stats);

    try {
      await sendEmail(transporter, {
        to: config.emailTo,
        subject: `📰 TechPulse AI - Digest du ${new Date().toLocaleDateString('fr-FR')}`,
        html: emailHtml,
        text: emailText,
      });

      console.log('✅ [Scheduler] Email envoyé avec succès!');
    } catch (error) {
      logSmtpError('Scheduler', error);
    }
  } catch (error) {
    console.error('❌ [Scheduler] Erreur lors du scraping quotidien:', error);
  }
};

/**
 * Initialize scheduler
 */
export const initializeScheduler = () => {
  const config: SchedulerConfig = {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    cronExpression: process.env.SCHEDULER_CRON || '0 9 * * *', // Default: every day at 9 AM
    feeds: parseFeedsFromEnv(process.env.SCHEDULER_FEEDS, DEFAULT_FEEDS),
    emailTo: process.env.SCHEDULER_EMAIL_TO || process.env.EMAIL_USER || '',
  };

  const autoPipelineConfig: AutoPipelineConfig = {
    enabled: process.env.AUTO_PIPELINE_ENABLED !== 'false',
    cronExpression: process.env.AUTO_PIPELINE_CRON || '0 * * * *',
    timezone: process.env.SCHEDULER_TIMEZONE || 'Europe/Paris',
    feeds: parseFeedsFromEnv(process.env.AUTO_PIPELINE_FEEDS || process.env.SCHEDULER_FEEDS, DEFAULT_FEEDS),
    maxPerCategory: parseInt(process.env.AUTO_SELECT_MAX_PER_CATEGORY || '5', 10),
    lookbackHours: parseInt(process.env.AUTO_PIPELINE_LOOKBACK_HOURS || '24', 10),
    runOnStart: process.env.AUTO_PIPELINE_RUN_ON_START === 'true',
  };

  const saturdayPodcastConfig: SaturdayPodcastConfig = {
    enabled: process.env.SATURDAY_PODCAST_ENABLED === 'true',
    cronExpression: process.env.SATURDAY_PODCAST_CRON || '0 10 * * 6',
    timezone: process.env.SATURDAY_PODCAST_TIMEZONE || process.env.SCHEDULER_TIMEZONE || 'Europe/Paris',
    emailTo: process.env.SATURDAY_PODCAST_EMAIL_TO || process.env.SCHEDULER_EMAIL_TO || process.env.EMAIL_USER || '',
    maxPerCategory: parseInt(process.env.SATURDAY_PODCAST_MAX_PER_CATEGORY || '2', 10),
    runOnStart: process.env.SATURDAY_PODCAST_RUN_ON_START === 'true',
    internalApiBaseUrl: process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5555}`,
  };

  let task: ScheduledTask | null = null;

  if (config.enabled && config.emailTo) {
    console.log(`⏰ [Scheduler] Activé avec cron: ${config.cronExpression}`);
    console.log(`📧 [Scheduler] Email destination: ${config.emailTo}`);
    console.log(`📡 [Scheduler] ${config.feeds.length} flux RSS configurés`);

    task = cron.schedule(config.cronExpression, () => {
      runDailyScraping(config);
    }, {
      timezone: process.env.SCHEDULER_TIMEZONE || 'Europe/Paris'
    });

    if (process.env.SCHEDULER_RUN_ON_START === 'true') {
      console.log('🔄 [Scheduler] Run-on-start activé');
      scheduleRunOnStart('Scheduler', () => runDailyScraping(config), 1000);
    }
  } else if (config.enabled && !config.emailTo) {
    console.warn('⚠️  [Scheduler] SCHEDULER_ENABLED=true mais SCHEDULER_EMAIL_TO absent: digest email désactivé');
  } else {
    console.log('⏸️  [Scheduler] Digest email désactivé (SCHEDULER_ENABLED=false)');
  }

  if (autoPipelineConfig.enabled) {
    console.log(`🤖 [AutoPipeline] Activé avec cron: ${autoPipelineConfig.cronExpression}`);
    console.log(`📡 [AutoPipeline] ${autoPipelineConfig.feeds.length} flux RSS configurés`);
    console.log(`🎯 [AutoPipeline] Top ${autoPipelineConfig.maxPerCategory} par catégorie | fenêtre ${autoPipelineConfig.lookbackHours}h`);

    cron.schedule(autoPipelineConfig.cronExpression, () => {
      runAutomatedBlogFeedPipeline(
        autoPipelineConfig.feeds,
        autoPipelineConfig.maxPerCategory,
        autoPipelineConfig.lookbackHours,
        'AutoPipeline'
      );
    }, {
      timezone: autoPipelineConfig.timezone
    });

    if (autoPipelineConfig.runOnStart) {
      console.log('🔄 [AutoPipeline] Run-on-start activé');
      scheduleRunOnStart('AutoPipeline', () => {
        runAutomatedBlogFeedPipeline(
          autoPipelineConfig.feeds,
          autoPipelineConfig.maxPerCategory,
          autoPipelineConfig.lookbackHours,
          'AutoPipeline'
        );
      }, 4000);
    }
  } else {
    console.log('⏸️  [AutoPipeline] Désactivé (AUTO_PIPELINE_ENABLED=false)');
  }

  if (saturdayPodcastConfig.enabled) {
    console.log(`🎙️ [SaturdayPodcast] Activé avec cron: ${saturdayPodcastConfig.cronExpression}`);
    console.log(`📧 [SaturdayPodcast] Email destination: ${saturdayPodcastConfig.emailTo || 'non configurée'}`);
    console.log(`🔎 [SaturdayPodcast] Base RSS interne: ${saturdayPodcastConfig.internalApiBaseUrl}/api/feeds/all.xml`);

    cron.schedule(saturdayPodcastConfig.cronExpression, () => {
      runSaturdayPodcastPipeline(saturdayPodcastConfig);
    }, {
      timezone: saturdayPodcastConfig.timezone
    });

    if (saturdayPodcastConfig.runOnStart) {
      console.log('🔄 [SaturdayPodcast] Run-on-start activé');
      scheduleRunOnStart('SaturdayPodcast', () => runSaturdayPodcastPipeline(saturdayPodcastConfig), 7000);
    }
  } else {
    console.log('⏸️  [SaturdayPodcast] Désactivé (SATURDAY_PODCAST_ENABLED=false)');
  }

  // Schedule monthly archive (le 1er de chaque mois à 2h du matin)
  cron.schedule('0 2 1 * *', () => {
    console.log('📆 [Scheduler] Archivage mensuel automatique...');
    runMonthlyArchive();
  }, {
    timezone: process.env.SCHEDULER_TIMEZONE || 'Europe/Paris'
  });

  console.log('📦 [Scheduler] Archivage mensuel programmé (1er du mois à 2h)');
  console.log('✅ [Scheduler] Initialisé avec succès');

  return task;
};

/**
 * Manually trigger scraping (for testing or manual runs)
 */
export const triggerManualScraping = async (emailTo: string): Promise<void> => {
  const config: SchedulerConfig = {
    enabled: true,
    cronExpression: '',
    feeds: process.env.SCHEDULER_FEEDS ? JSON.parse(process.env.SCHEDULER_FEEDS) : DEFAULT_FEEDS,
    emailTo,
  };

  await runDailyScraping(config);
};

/**
 * Trigger blog feed update only (without email)
 * Fetches articles, categorizes them, and saves to blog feed
 */
export const triggerBlogFeedUpdate = async (customFeeds?: string[]): Promise<{ saved: number; duplicates: number }> => {
  console.log('🔄 [BlogFeed] Mise à jour manuelle du flux Blog...');
  const feeds = customFeeds || parseFeedsFromEnv(process.env.AUTO_PIPELINE_FEEDS || process.env.SCHEDULER_FEEDS, DEFAULT_FEEDS);
  const maxPerCategory = parseInt(process.env.AUTO_SELECT_MAX_PER_CATEGORY || '5', 10);
  const lookbackHours = parseInt(process.env.AUTO_PIPELINE_LOOKBACK_HOURS || '24', 10);
  
  try {
    const result = await runAutomatedBlogFeedPipeline(feeds, maxPerCategory, lookbackHours, 'BlogFeed');
    return { saved: result.saved, duplicates: result.duplicates };
  } catch (error) {
    console.error('❌ [BlogFeed] Erreur lors de la mise à jour:', error);
    throw error;
  }
};

export const triggerSaturdayPodcastDigest = async (): Promise<void> => {
  const config: SaturdayPodcastConfig = {
    enabled: true,
    cronExpression: '',
    timezone: process.env.SATURDAY_PODCAST_TIMEZONE || process.env.SCHEDULER_TIMEZONE || 'Europe/Paris',
    emailTo: process.env.SATURDAY_PODCAST_EMAIL_TO || process.env.SCHEDULER_EMAIL_TO || process.env.EMAIL_USER || '',
    maxPerCategory: parseInt(process.env.SATURDAY_PODCAST_MAX_PER_CATEGORY || '2', 10),
    runOnStart: false,
    internalApiBaseUrl: process.env.INTERNAL_API_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5555}`,
  };

  await runSaturdayPodcastPipeline(config);
};

/**
 * Archive du mois précédent (à exécuter le 1er de chaque mois)
 */
const runMonthlyArchive = async () => {
  console.log('📦 [Scheduler] Démarrage de l\'archivage mensuel...');
  
  try {
    const result = archivePreviousMonth();
    
    if (result) {
      console.log(`✅ [Scheduler] Archivage terminé: ${result.archived} articles pour ${result.month}`);
      return result;
    } else {
      console.log('ℹ️  [Scheduler] Aucun article à archiver pour le mois précédent');
      return null;
    }
  } catch (error) {
    console.error('❌ [Scheduler] Erreur lors de l\'archivage:', error);
    throw error;
  }
};
