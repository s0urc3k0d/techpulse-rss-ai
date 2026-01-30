/**
 * Feed Export Service - Sauvegarde des articles pour export RSS vers blog
 */

import { ProcessedArticle, PodcastScriptItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface SavedArticleInput {
  title: string;
  link: string;
  description: string;
  source: string;
  pubDate: string;
  category: string;
  summary?: string;
  keyPoints?: string[];
  catchyTitle?: string;
}

export interface FeedStats {
  totalSaved: number;
  currentMonthCount: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byMonth: Record<string, number>;
  lastUpdated: string;
}

export interface FeedCategory {
  name: string;
  slug: string;
  count: number;
}

export interface FeedMonth {
  month: string;
  articleCount: number;
  isArchived: boolean;
  weeks?: number;
}

export interface SaveResult {
  success: boolean;
  saved: number;
  duplicates: number;
  total: number;
  message: string;
  feedUrl: string;
}

/**
 * Sauvegarde des articles pour le flux RSS du blog
 */
export const saveArticlesForBlog = async (
  articles: ProcessedArticle[],
  podcastData?: Map<string, PodcastScriptItem>
): Promise<SaveResult> => {
  // Préparer les articles avec enrichissement
  const articlesToSave: SavedArticleInput[] = articles.map(article => {
    const podcastInfo = podcastData?.get(article.id);
    
    return {
      title: article.title,
      link: article.link,
      description: article.description,
      source: article.source,
      pubDate: article.isoDate.toISOString(),
      category: article.category,
      summary: article.summary,
      keyPoints: podcastInfo?.keyPoints,
      catchyTitle: podcastInfo?.catchyTitle
    };
  });

  const response = await fetch(`${API_BASE_URL}/feeds/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      articles: articlesToSave,
      savedBy: 'manual'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP error ${response.status}`);
  }

  return await response.json();
};

/**
 * Récupère les statistiques du flux RSS (enrichies avec infos temporelles)
 */
export const getFeedStats = async (): Promise<{
  stats: FeedStats;
  categories: FeedCategory[];
  months: FeedMonth[];
  feedUrls: {
    all: string;
    byCategory: Array<{ name: string; url: string; count: number }>;
    byMonth: Array<{ month: string; url: string; count: number; isArchived: boolean }>;
  };
}> => {
  const response = await fetch(`${API_BASE_URL}/feeds/stats`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP error ${response.status}`);
  }

  const data = await response.json();
  return data;
};

/**
 * Récupère les catégories disponibles
 */
export const getFeedCategories = async (): Promise<FeedCategory[]> => {
  const response = await fetch(`${API_BASE_URL}/feeds/categories`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch categories');
  }

  const data = await response.json();
  return data.categories;
};

/**
 * Récupère les articles sauvegardés (JSON)
 */
export const getSavedArticles = async (options?: {
  category?: string;
  limit?: number;
  since?: string;
  until?: string;
  month?: string; // YYYY-MM pour accéder aux archives
}): Promise<SavedArticleInput[]> => {
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.since) params.append('since', options.since);
  if (options?.until) params.append('until', options.until);
  if (options?.month) params.append('month', options.month);

  const url = `${API_BASE_URL}/feeds/articles${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch saved articles');
  }

  const data = await response.json();
  return data.articles;
};

/**
 * Récupère les mois disponibles (courant + archives)
 */
export const getAvailableMonths = async (): Promise<FeedMonth[]> => {
  const response = await fetch(`${API_BASE_URL}/feeds/months`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch available months');
  }

  const data = await response.json();
  return data.months;
};

/**
 * Déclenche l'archivage manuel du mois précédent
 */
export const triggerArchive = async (): Promise<{ success: boolean; message: string; archived?: number; month?: string }> => {
  const response = await fetch(`${API_BASE_URL}/feeds/archive`, {
    method: 'POST'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to trigger archive');
  }

  return await response.json();
};

/**
 * Supprime un article du flux
 */
export const deleteArticleFromFeed = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/feeds/article/${id}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete article');
  }
};

/**
 * Supprime tous les articles du flux
 */
export const clearAllFeedArticles = async (): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/feeds/clear`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to clear articles');
  }
};

/**
 * Génère l'URL du flux RSS (catégorie ou mois d'archive)
 */
export const getFeedUrl = (options?: { category?: string; month?: string }): string => {
  const baseUrl = window.location.origin;
  if (options?.month) {
    return `${baseUrl}/api/feeds/archive/${options.month}.xml`;
  }
  if (options?.category) {
    return `${baseUrl}/api/feeds/${options.category}.xml`;
  }
  return `${baseUrl}/api/feeds/all.xml`;
};

/**
 * Copie l'URL du flux dans le presse-papier
 */
export const copyFeedUrl = async (options?: { category?: string; month?: string }): Promise<void> => {
  const url = getFeedUrl(options);
  await navigator.clipboard.writeText(url);
};
