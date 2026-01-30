/**
 * Feed Storage - Gestion du stockage des articles pour export RSS
 * Utilise un fichier JSON pour persister les articles sauvegardés
 */

import fs from 'fs';
import path from 'path';

// Chemin du fichier de stockage
const STORAGE_DIR = path.join(process.cwd(), 'data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'saved-articles.json');

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

interface StorageData {
  articles: SavedArticle[];
  lastUpdated: string;
  stats: {
    totalSaved: number;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
  };
}

/**
 * Initialise le répertoire et fichier de stockage
 */
const initStorage = (): void => {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    console.log('📁 Répertoire data/ créé');
  }
  
  if (!fs.existsSync(STORAGE_FILE)) {
    const initialData: StorageData = {
      articles: [],
      lastUpdated: new Date().toISOString(),
      stats: {
        totalSaved: 0,
        byCategory: {},
        bySource: {}
      }
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(initialData, null, 2));
    console.log('📄 Fichier saved-articles.json créé');
  }
};

/**
 * Charge les données depuis le fichier
 */
const loadStorage = (): StorageData => {
  initStorage();
  try {
    const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Erreur lecture storage:', error);
    return {
      articles: [],
      lastUpdated: new Date().toISOString(),
      stats: { totalSaved: 0, byCategory: {}, bySource: {} }
    };
  }
};

/**
 * Sauvegarde les données dans le fichier
 */
const saveStorage = (data: StorageData): void => {
  initStorage();
  // Recalculer les stats
  data.stats = {
    totalSaved: data.articles.length,
    byCategory: data.articles.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    bySource: data.articles.reduce((acc, a) => {
      acc[a.source] = (acc[a.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
};

/**
 * Génère un ID unique basé sur l'URL (pour déduplication)
 */
const generateArticleId = (link: string): string => {
  // Hash simple de l'URL
  let hash = 0;
  for (let i = 0; i < link.length; i++) {
    const char = link.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `art_${Math.abs(hash).toString(36)}`;
};

/**
 * Vérifie si un article existe déjà (par URL)
 */
export const articleExists = (link: string): boolean => {
  const data = loadStorage();
  return data.articles.some(a => a.link === link);
};

/**
 * Ajoute des articles au stockage (avec déduplication)
 */
export const saveArticles = (
  articles: Omit<SavedArticle, 'id' | 'savedAt'>[],
  savedBy: 'manual' | 'auto' = 'manual'
): { saved: number; duplicates: number; total: number } => {
  const data = loadStorage();
  const existingLinks = new Set(data.articles.map(a => a.link));
  
  let saved = 0;
  let duplicates = 0;
  
  for (const article of articles) {
    if (existingLinks.has(article.link)) {
      duplicates++;
      continue;
    }
    
    const savedArticle: SavedArticle = {
      ...article,
      id: generateArticleId(article.link),
      savedAt: new Date().toISOString(),
      savedBy
    };
    
    data.articles.push(savedArticle);
    existingLinks.add(article.link);
    saved++;
  }
  
  if (saved > 0) {
    // Trier par date de publication (plus récent en premier)
    data.articles.sort((a, b) => 
      new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );
    saveStorage(data);
  }
  
  console.log(`💾 Articles sauvegardés: ${saved} nouveaux, ${duplicates} doublons ignorés`);
  
  return { saved, duplicates, total: data.articles.length };
};

/**
 * Récupère tous les articles sauvegardés
 */
export const getAllArticles = (options?: {
  category?: string;
  limit?: number;
  since?: Date;
  until?: Date;
}): SavedArticle[] => {
  const data = loadStorage();
  let articles = [...data.articles];
  
  // Filtre par catégorie
  if (options?.category) {
    const categorySlug = options.category.toLowerCase();
    articles = articles.filter(a => 
      slugifyCategory(a.category) === categorySlug
    );
  }
  
  // Filtre par date (depuis)
  if (options?.since) {
    articles = articles.filter(a => 
      new Date(a.pubDate) >= options.since!
    );
  }
  
  // Filtre par date (jusqu'à)
  if (options?.until) {
    articles = articles.filter(a => 
      new Date(a.pubDate) <= options.until!
    );
  }
  
  // Limite
  if (options?.limit && options.limit > 0) {
    articles = articles.slice(0, options.limit);
  }
  
  return articles;
};

/**
 * Récupère les statistiques
 */
export const getStats = (): StorageData['stats'] & { lastUpdated: string } => {
  const data = loadStorage();
  return {
    ...data.stats,
    lastUpdated: data.lastUpdated
  };
};

/**
 * Récupère les catégories disponibles
 */
export const getCategories = (): Array<{ name: string; slug: string; count: number }> => {
  const data = loadStorage();
  return Object.entries(data.stats.byCategory).map(([name, count]) => ({
    name,
    slug: slugifyCategory(name),
    count
  }));
};

/**
 * Supprime un article par ID
 */
export const deleteArticle = (id: string): boolean => {
  const data = loadStorage();
  const initialLength = data.articles.length;
  data.articles = data.articles.filter(a => a.id !== id);
  
  if (data.articles.length < initialLength) {
    saveStorage(data);
    return true;
  }
  return false;
};

/**
 * Supprime tous les articles
 */
export const clearAllArticles = (): void => {
  const data = loadStorage();
  data.articles = [];
  saveStorage(data);
  console.log('🗑️ Tous les articles ont été supprimés');
};

/**
 * Convertit une catégorie en slug URL-friendly
 */
export const slugifyCategory = (category: string): string => {
  return category
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlève les accents
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
