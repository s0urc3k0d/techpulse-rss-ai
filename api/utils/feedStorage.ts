/**
 * Feed Storage v2 - Gestion temporelle des articles pour export RSS
 * 
 * Architecture :
 * data/
 * ├── index.json                 # Index global (stats, métadonnées, index URLs)
 * ├── current/
 * │   └── articles.json          # Articles du mois en cours
 * └── archives/
 *     ├── 2026-01/
 *     │   ├── week-01.json       # Semaine 1
 *     │   ├── week-02.json       # Semaine 2
 *     │   └── ...
 *     └── 2026-02/
 *         └── ...
 */

import fs from 'fs';
import path from 'path';

// Chemins de stockage
const STORAGE_DIR = path.join(process.cwd(), 'data');
const INDEX_FILE = path.join(STORAGE_DIR, 'index.json');
const CURRENT_DIR = path.join(STORAGE_DIR, 'current');
const ARCHIVES_DIR = path.join(STORAGE_DIR, 'archives');

// Rétrocompatibilité : ancien fichier
const LEGACY_FILE = path.join(STORAGE_DIR, 'saved-articles.json');

export interface SavedArticle {
  id: string;
  // Métadonnées originales
  title: string;
  link: string;
  description: string;
  source: string;
  pubDate: string;
  // Enrichissement IA
  category: string;
  summary?: string;
  keyPoints?: string[];
  catchyTitle?: string;
  // Métadonnées de sauvegarde
  savedAt: string;
  savedBy: 'manual' | 'auto';
}

interface MonthFile {
  month: string; // YYYY-MM
  articles: SavedArticle[];
  lastUpdated: string;
}

interface IndexData {
  version: string;
  lastUpdated: string;
  totalArticles: number;
  // Index des URLs pour déduplication rapide O(1)
  urlIndex: Record<string, { fileDate: string; savedAt: string }>;
  // Stats globales
  stats: {
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
    byMonth: Record<string, number>;
  };
  // Liste des archives disponibles
  archives: Array<{
    month: string;
    weeks: string[];
    articleCount: number;
  }>;
}

// ==================== HELPERS ====================

/**
 * Obtient le mois (YYYY-MM) pour une date
 */
const getMonthKey = (date: Date): string => {
  return date.toISOString().slice(0, 7);
};

/**
 * Obtient le numéro de semaine dans le mois
 */
const getWeekOfMonth = (date: Date): number => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
};

/**
 * Initialise la structure de stockage
 */
const initStorage = (): void => {
  // Créer les répertoires
  [STORAGE_DIR, CURRENT_DIR, ARCHIVES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Répertoire ${path.basename(dir)}/ créé`);
    }
  });
  
  // Migration depuis l'ancien format si nécessaire
  if (fs.existsSync(LEGACY_FILE) && !fs.existsSync(INDEX_FILE)) {
    migrateFromLegacy();
    return;
  }
  
  // Créer l'index s'il n'existe pas
  if (!fs.existsSync(INDEX_FILE)) {
    const initialIndex: IndexData = {
      version: '2.0',
      lastUpdated: new Date().toISOString(),
      totalArticles: 0,
      urlIndex: {},
      stats: {
        byCategory: {},
        bySource: {},
        byMonth: {}
      },
      archives: []
    };
    fs.writeFileSync(INDEX_FILE, JSON.stringify(initialIndex, null, 2));
    console.log('📄 Index créé');
  }
  
  // Créer le fichier courant s'il n'existe pas
  const currentFile = path.join(CURRENT_DIR, 'articles.json');
  if (!fs.existsSync(currentFile)) {
    const initialCurrent: MonthFile = {
      month: getMonthKey(new Date()),
      articles: [],
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(currentFile, JSON.stringify(initialCurrent, null, 2));
    console.log('📄 Fichier courant créé');
  }
};

/**
 * Migration depuis l'ancien format (saved-articles.json unique)
 */
const migrateFromLegacy = (): void => {
  console.log('🔄 Migration depuis l\'ancien format...');
  
  try {
    const legacyData = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf-8'));
    const articles: SavedArticle[] = legacyData.articles || [];
    
    // Créer l'index
    const index: IndexData = {
      version: '2.0',
      lastUpdated: new Date().toISOString(),
      totalArticles: articles.length,
      urlIndex: {},
      stats: {
        byCategory: legacyData.stats?.byCategory || {},
        bySource: legacyData.stats?.bySource || {},
        byMonth: {}
      },
      archives: []
    };
    
    // Créer le fichier courant avec tous les articles
    const currentFile = path.join(CURRENT_DIR, 'articles.json');
    const currentData: MonthFile = {
      month: getMonthKey(new Date()),
      articles: articles,
      lastUpdated: new Date().toISOString()
    };
    
    // Indexer les URLs et compter par mois
    articles.forEach(article => {
      index.urlIndex[article.link] = {
        fileDate: getMonthKey(new Date(article.savedAt || article.pubDate)),
        savedAt: article.savedAt
      };
      const monthKey = getMonthKey(new Date(article.savedAt || article.pubDate));
      index.stats.byMonth[monthKey] = (index.stats.byMonth[monthKey] || 0) + 1;
    });
    
    fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
    fs.writeFileSync(currentFile, JSON.stringify(currentData, null, 2));
    
    // Renommer l'ancien fichier
    fs.renameSync(LEGACY_FILE, path.join(STORAGE_DIR, 'saved-articles.json.backup'));
    
    console.log(`✅ Migration terminée: ${articles.length} articles importés`);
  } catch (error) {
    console.error('❌ Erreur de migration:', error);
  }
};

/**
 * Charge l'index global
 */
const loadIndex = (): IndexData => {
  initStorage();
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  } catch (error) {
    console.error('Erreur lecture index:', error);
    return {
      version: '2.0',
      lastUpdated: new Date().toISOString(),
      totalArticles: 0,
      urlIndex: {},
      stats: { byCategory: {}, bySource: {}, byMonth: {} },
      archives: []
    };
  }
};

/**
 * Sauvegarde l'index global
 */
const saveIndex = (index: IndexData): void => {
  index.lastUpdated = new Date().toISOString();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
};

/**
 * Charge un fichier d'articles
 */
const loadArticlesFile = (filePath: string): MonthFile => {
  if (!fs.existsSync(filePath)) {
    return {
      month: '',
      articles: [],
      lastUpdated: new Date().toISOString()
    };
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return { month: '', articles: [], lastUpdated: new Date().toISOString() };
  }
};

/**
 * Sauvegarde un fichier d'articles
 */
const saveArticlesFile = (filePath: string, data: MonthFile): void => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// ==================== API PUBLIQUE ====================

/**
 * Génère un ID unique basé sur l'URL (pour déduplication)
 */
const generateArticleId = (link: string): string => {
  let hash = 0;
  for (let i = 0; i < link.length; i++) {
    const char = link.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `art_${Math.abs(hash).toString(36)}`;
};

/**
 * Vérifie si un article existe déjà (par URL) - O(1) grâce à l'index
 */
export const articleExists = (link: string): boolean => {
  const index = loadIndex();
  return link in index.urlIndex;
};

/**
 * Ajoute des articles au stockage (avec déduplication)
 */
export const saveArticles = (
  articles: Omit<SavedArticle, 'id' | 'savedAt'>[],
  savedBy: 'manual' | 'auto' = 'manual'
): { saved: number; duplicates: number; total: number } => {
  initStorage();
  const index = loadIndex();
  const now = new Date();
  const currentFilePath = path.join(CURRENT_DIR, 'articles.json');
  const currentData = loadArticlesFile(currentFilePath);
  
  let saved = 0;
  let duplicates = 0;
  
  for (const article of articles) {
    // Vérification doublon via index (O(1))
    if (article.link in index.urlIndex) {
      duplicates++;
      continue;
    }
    
    const savedArticle: SavedArticle = {
      ...article,
      id: generateArticleId(article.link),
      savedAt: now.toISOString(),
      savedBy
    };
    
    // Ajouter à l'index
    index.urlIndex[article.link] = {
      fileDate: getMonthKey(now),
      savedAt: savedArticle.savedAt
    };
    
    // Mise à jour stats
    index.stats.byCategory[article.category] = (index.stats.byCategory[article.category] || 0) + 1;
    index.stats.bySource[article.source] = (index.stats.bySource[article.source] || 0) + 1;
    const monthKey = getMonthKey(now);
    index.stats.byMonth[monthKey] = (index.stats.byMonth[monthKey] || 0) + 1;
    
    // Ajouter au fichier courant
    currentData.articles.push(savedArticle);
    index.totalArticles++;
    saved++;
  }
  
  if (saved > 0) {
    // Trier par date (plus récent en premier)
    currentData.articles.sort((a, b) => 
      new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
    currentData.month = getMonthKey(now);
    
    saveArticlesFile(currentFilePath, currentData);
    saveIndex(index);
  }
  
  console.log(`💾 Articles sauvegardés: ${saved} nouveaux, ${duplicates} doublons ignorés`);
  
  return { saved, duplicates, total: index.totalArticles };
};

/**
 * Obtient les mois entre deux dates
 */
const getMonthsBetween = (startMonth: string, endMonth: string): string[] => {
  const months: string[] = [];
  const [startYear, startM] = startMonth.split('-').map(Number);
  const [endYear, endM] = endMonth.split('-').map(Number);
  
  let year = startYear;
  let month = startM;
  
  while (year < endYear || (year === endYear && month <= endM)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  
  return months;
};

/**
 * Récupère les articles avec filtres temporels
 */
export const getAllArticles = (options?: {
  category?: string;
  limit?: number;
  since?: Date;
  until?: Date;
  month?: string; // YYYY-MM pour accéder aux archives
}): SavedArticle[] => {
  initStorage();
  let articles: SavedArticle[] = [];
  
  // Charger depuis le mois spécifié ou le mois courant
  if (options?.month) {
    const currentMonth = getMonthKey(new Date());
    
    if (options.month === currentMonth) {
      // Mois courant
      const currentFilePath = path.join(CURRENT_DIR, 'articles.json');
      const currentData = loadArticlesFile(currentFilePath);
      articles = [...currentData.articles];
    } else {
      // Charger depuis les archives
      const archiveDir = path.join(ARCHIVES_DIR, options.month);
      if (fs.existsSync(archiveDir)) {
        const weekFiles = fs.readdirSync(archiveDir).filter(f => f.endsWith('.json'));
        for (const weekFile of weekFiles) {
          const data = loadArticlesFile(path.join(archiveDir, weekFile));
          articles.push(...data.articles);
        }
      }
    }
  } else {
    // Charger le fichier courant
    const currentFilePath = path.join(CURRENT_DIR, 'articles.json');
    const currentData = loadArticlesFile(currentFilePath);
    articles = [...currentData.articles];
    
    // Si on demande une période qui inclut les archives
    if (options?.since) {
      const sinceMonth = getMonthKey(options.since);
      const currentMonth = getMonthKey(new Date());
      
      if (sinceMonth < currentMonth) {
        // Charger les archives nécessaires
        const archiveMonths = getMonthsBetween(sinceMonth, currentMonth);
        for (const month of archiveMonths) {
          if (month === currentMonth) continue; // Déjà chargé
          const archiveDir = path.join(ARCHIVES_DIR, month);
          if (fs.existsSync(archiveDir)) {
            const weekFiles = fs.readdirSync(archiveDir).filter(f => f.endsWith('.json'));
            for (const weekFile of weekFiles) {
              const data = loadArticlesFile(path.join(archiveDir, weekFile));
              articles.push(...data.articles);
            }
          }
        }
      }
    }
  }
  
  // Appliquer les filtres
  if (options?.category) {
    const categorySlug = options.category.toLowerCase();
    articles = articles.filter(a => slugifyCategory(a.category) === categorySlug);
  }
  
  if (options?.since) {
    articles = articles.filter(a => new Date(a.savedAt) >= options.since!);
  }
  
  if (options?.until) {
    articles = articles.filter(a => new Date(a.savedAt) <= options.until!);
  }
  
  // Trier par date de sauvegarde (plus récent en premier)
  articles.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  
  if (options?.limit && options.limit > 0) {
    articles = articles.slice(0, options.limit);
  }
  
  return articles;
};

/**
 * Archive le mois précédent (à appeler via cron le 1er de chaque mois)
 */
export const archivePreviousMonth = (): { archived: number; month: string } | null => {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = getMonthKey(prevMonth);
  const currentMonthKey = getMonthKey(now);
  
  const currentFilePath = path.join(CURRENT_DIR, 'articles.json');
  const currentData = loadArticlesFile(currentFilePath);
  
  // Séparer les articles du mois précédent et du mois courant
  const prevMonthArticles = currentData.articles.filter(a => {
    const articleMonth = getMonthKey(new Date(a.savedAt));
    return articleMonth === prevMonthKey;
  });
  
  const currentMonthArticles = currentData.articles.filter(a => {
    const articleMonth = getMonthKey(new Date(a.savedAt));
    return articleMonth === currentMonthKey;
  });
  
  if (prevMonthArticles.length === 0) {
    console.log(`📦 Aucun article à archiver pour ${prevMonthKey}`);
    return null;
  }
  
  // Créer les fichiers d'archive par semaine
  const archiveDir = path.join(ARCHIVES_DIR, prevMonthKey);
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  
  // Grouper par semaine
  const byWeek: Record<number, SavedArticle[]> = {};
  prevMonthArticles.forEach(article => {
    const week = getWeekOfMonth(new Date(article.savedAt));
    if (!byWeek[week]) byWeek[week] = [];
    byWeek[week].push(article);
  });
  
  // Sauvegarder chaque semaine
  const weeks: string[] = [];
  for (const [weekNum, weekArticles] of Object.entries(byWeek)) {
    const weekFile = `week-${String(weekNum).padStart(2, '0')}.json`;
    const weekData: MonthFile = {
      month: prevMonthKey,
      articles: weekArticles,
      lastUpdated: new Date().toISOString()
    };
    saveArticlesFile(path.join(archiveDir, weekFile), weekData);
    weeks.push(weekFile);
  }
  
  // Mettre à jour l'index des archives
  const index = loadIndex();
  const existingArchive = index.archives.find(a => a.month === prevMonthKey);
  if (existingArchive) {
    existingArchive.weeks = weeks;
    existingArchive.articleCount = prevMonthArticles.length;
  } else {
    index.archives.push({
      month: prevMonthKey,
      weeks,
      articleCount: prevMonthArticles.length
    });
    // Trier par mois décroissant
    index.archives.sort((a, b) => b.month.localeCompare(a.month));
  }
  saveIndex(index);
  
  // Mettre à jour le fichier courant (ne garder que le mois en cours)
  currentData.articles = currentMonthArticles;
  currentData.month = currentMonthKey;
  saveArticlesFile(currentFilePath, currentData);
  
  console.log(`📦 Archivé ${prevMonthArticles.length} articles de ${prevMonthKey} en ${weeks.length} semaines`);
  
  return { archived: prevMonthArticles.length, month: prevMonthKey };
};

/**
 * Récupère les statistiques enrichies
 */
export const getStats = (): {
  totalSaved: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byMonth: Record<string, number>;
  lastUpdated: string;
  archives: IndexData['archives'];
  currentMonthCount: number;
} => {
  const index = loadIndex();
  const currentMonth = getMonthKey(new Date());
  return {
    totalSaved: index.totalArticles,
    byCategory: index.stats.byCategory,
    bySource: index.stats.bySource,
    byMonth: index.stats.byMonth,
    lastUpdated: index.lastUpdated,
    archives: index.archives,
    currentMonthCount: index.stats.byMonth[currentMonth] || 0
  };
};

/**
 * Récupère les catégories disponibles
 */
export const getCategories = (): Array<{ name: string; slug: string; count: number }> => {
  const index = loadIndex();
  return Object.entries(index.stats.byCategory)
    .map(([name, count]) => ({
      name,
      slug: slugifyCategory(name),
      count
    }))
    .sort((a, b) => b.count - a.count);
};

/**
 * Récupère les mois disponibles (courant + archives)
 */
export const getAvailableMonths = (): Array<{ 
  month: string; 
  articleCount: number; 
  isArchived: boolean;
  weeks?: number;
}> => {
  const index = loadIndex();
  const currentMonth = getMonthKey(new Date());
  const result: Array<{ month: string; articleCount: number; isArchived: boolean; weeks?: number }> = [];
  
  // Ajouter le mois courant
  const currentCount = index.stats.byMonth[currentMonth] || 0;
  if (currentCount > 0) {
    result.push({
      month: currentMonth,
      articleCount: currentCount,
      isArchived: false
    });
  }
  
  // Ajouter les archives
  index.archives.forEach(a => {
    result.push({
      month: a.month,
      articleCount: a.articleCount,
      isArchived: true,
      weeks: a.weeks.length
    });
  });
  
  return result;
};

/**
 * Supprime un article par ID
 */
export const deleteArticle = (id: string): boolean => {
  const currentFilePath = path.join(CURRENT_DIR, 'articles.json');
  const currentData = loadArticlesFile(currentFilePath);
  
  const article = currentData.articles.find(a => a.id === id);
  if (!article) return false;
  
  // Retirer de la liste
  currentData.articles = currentData.articles.filter(a => a.id !== id);
  saveArticlesFile(currentFilePath, currentData);
  
  // Mettre à jour l'index
  const index = loadIndex();
  delete index.urlIndex[article.link];
  index.totalArticles--;
  
  if (index.stats.byCategory[article.category]) {
    index.stats.byCategory[article.category]--;
    if (index.stats.byCategory[article.category] === 0) {
      delete index.stats.byCategory[article.category];
    }
  }
  
  if (index.stats.bySource[article.source]) {
    index.stats.bySource[article.source]--;
    if (index.stats.bySource[article.source] === 0) {
      delete index.stats.bySource[article.source];
    }
  }
  
  const monthKey = getMonthKey(new Date(article.savedAt));
  if (index.stats.byMonth[monthKey]) {
    index.stats.byMonth[monthKey]--;
    if (index.stats.byMonth[monthKey] === 0) {
      delete index.stats.byMonth[monthKey];
    }
  }
  
  saveIndex(index);
  
  return true;
};

/**
 * Supprime tous les articles (reset complet)
 */
export const clearAllArticles = (): void => {
  // Supprimer les fichiers courants
  const currentFilePath = path.join(CURRENT_DIR, 'articles.json');
  if (fs.existsSync(currentFilePath)) {
    fs.unlinkSync(currentFilePath);
  }
  
  // Supprimer les archives
  if (fs.existsSync(ARCHIVES_DIR)) {
    fs.rmSync(ARCHIVES_DIR, { recursive: true, force: true });
    fs.mkdirSync(ARCHIVES_DIR, { recursive: true });
  }
  
  // Réinitialiser l'index
  const freshIndex: IndexData = {
    version: '2.0',
    lastUpdated: new Date().toISOString(),
    totalArticles: 0,
    urlIndex: {},
    stats: { byCategory: {}, bySource: {}, byMonth: {} },
    archives: []
  };
  saveIndex(freshIndex);
  
  // Recréer le fichier courant
  initStorage();
  
  console.log('🗑️ Tous les articles ont été supprimés');
};

/**
 * Convertit une catégorie en slug URL-friendly
 */
export const slugifyCategory = (category: string): string => {
  return category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

/**
 * Récupère une catégorie depuis son slug
 */
export const getCategoryFromSlug = (slug: string): string | null => {
  const categories = getCategories();
  const found = categories.find(c => c.slug === slug);
  return found?.name || null;
};
