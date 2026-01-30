import cron from 'node-cron';
import { XMLParser } from 'fast-xml-parser';
import { categorizeForScheduler, getProviderInfo } from './utils/aiProvider.js';
import { 
  createEmailTransporter, 
  sendEmail, 
  generateDailyDigestEmail, 
  generateDailyDigestText 
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

    await sendEmail(transporter, {
      to: config.emailTo,
      subject: `📰 TechPulse AI - Digest du ${new Date().toLocaleDateString('fr-FR')}`,
      html: emailHtml,
      text: emailText,
    });

    console.log('✅ [Scheduler] Email envoyé avec succès!');
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
    feeds: process.env.SCHEDULER_FEEDS ? JSON.parse(process.env.SCHEDULER_FEEDS) : DEFAULT_FEEDS,
    emailTo: process.env.SCHEDULER_EMAIL_TO || process.env.EMAIL_USER || '',
  };

  if (!config.enabled) {
    console.log('⏸️  [Scheduler] Désactivé (SCHEDULER_ENABLED=false)');
    return null;
  }

  if (!config.emailTo) {
    console.warn('⚠️  [Scheduler] Aucune adresse email configurée (SCHEDULER_EMAIL_TO)');
    return null;
  }

  console.log(`⏰ [Scheduler] Activé avec cron: ${config.cronExpression}`);
  console.log(`📧 [Scheduler] Email destination: ${config.emailTo}`);
  console.log(`📡 [Scheduler] ${config.feeds.length} flux RSS configurés`);

  // Schedule the daily job
  const task = cron.schedule(config.cronExpression, () => {
    runDailyScraping(config);
  }, {
    timezone: process.env.SCHEDULER_TIMEZONE || 'Europe/Paris'
  });

  // Schedule monthly archive (le 1er de chaque mois à 2h du matin)
  const archiveTask = cron.schedule('0 2 1 * *', () => {
    console.log('📆 [Scheduler] Archivage mensuel automatique...');
    runMonthlyArchive();
  }, {
    timezone: process.env.SCHEDULER_TIMEZONE || 'Europe/Paris'
  });

  console.log('📦 [Scheduler] Archivage mensuel programmé (1er du mois à 2h)');
  console.log('✅ [Scheduler] Initialisé avec succès');

  // Optional: Run immediately if in dev mode
  if (process.env.SCHEDULER_RUN_ON_START === 'true') {
    console.log('🔄 [Scheduler] Exécution immédiate au démarrage...');
    setTimeout(() => runDailyScraping(config), 5000); // Wait 5s for server to be ready
  }

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
  
  const feeds = customFeeds || (process.env.SCHEDULER_FEEDS ? JSON.parse(process.env.SCHEDULER_FEEDS) : DEFAULT_FEEDS);
  
  try {
    // 1. Fetch RSS feeds
    console.log(`📡 [BlogFeed] Récupération de ${feeds.length} flux RSS...`);
    const allItems: any[] = [];
    
    for (const feedUrl of feeds) {
      try {
        const items = await fetchAndParseRSS(feedUrl);
        // Filter out already existing articles immediately
        const newItems = items.filter((item: any) => !articleExists(item.link));
        allItems.push(...newItems);
        console.log(`✅ [BlogFeed] ${newItems.length} nouveaux articles depuis ${feedUrl}`);
      } catch (error) {
        console.error(`❌ [BlogFeed] Erreur flux ${feedUrl}:`, error);
      }
    }

    if (allItems.length === 0) {
      console.log('⚠️  [BlogFeed] Aucun nouvel article à traiter');
      return { saved: 0, duplicates: 0 };
    }

    // 2. Filter articles from last 24h
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    const recentArticles = allItems.filter(item => item.isoDate >= last24Hours);
    
    console.log(`📅 [BlogFeed] ${recentArticles.length} articles des dernières 24h`);

    if (recentArticles.length === 0) {
      console.log('⚠️  [BlogFeed] Aucun article récent');
      return { saved: 0, duplicates: 0 };
    }

    // 3. Categorize with AI
    console.log(`🤖 [BlogFeed] Catégorisation IA en cours avec ${getProviderInfo()}...`);
    
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
        console.error('❌ [BlogFeed] Erreur catégorisation batch:', error);
        batch.forEach((article: any) => {
          categorized.push({
            ...article,
            category: 'Autre',
            id: `${article.source}-${article.title}`.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 50)
          });
        });
      }
    }

    // 4. Save to Blog Feed
    const articlesToSave = categorized.map((a: any) => ({
      title: a.title,
      link: a.link,
      description: a.description || '',
      source: a.source,
      pubDate: a.isoDate.toISOString(),
      category: a.category,
      savedBy: 'auto' as const
    }));
    
    const result = saveArticles(articlesToSave, 'auto');
    console.log(`✅ [BlogFeed] ${result.saved} articles sauvegardés, ${result.duplicates} doublons ignorés`);
    
    return { saved: result.saved, duplicates: result.duplicates };
  } catch (error) {
    console.error('❌ [BlogFeed] Erreur lors de la mise à jour:', error);
    throw error;
  }
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
