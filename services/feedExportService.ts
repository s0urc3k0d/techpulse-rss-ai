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
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  lastUpdated: string;
}

export interface FeedCategory {
  name: string;
  slug: string;
  count: number;
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
 * Récupère les statistiques du flux RSS
 */
export const getFeedStats = async (): Promise<{
  stats: FeedStats;
  categories: FeedCategory[];
  feedUrls: {
    all: string;
    byCategory: Array<{ name: string; url: string; count: number }>;
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
}): Promise<SavedArticleInput[]> => {
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.since) params.append('since', options.since);
  if (options?.until) params.append('until', options.until);

  const url = `${API_BASE_URL}/feeds/articles${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch saved articles');
  }

  const data = await response.json();
  return data.articles;
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
 * Génère l'URL du flux RSS
 */
export const getFeedUrl = (category?: string): string => {
  const baseUrl = window.location.origin;
  if (category) {
    return `${baseUrl}/api/feeds/${category}.xml`;
  }
  return `${baseUrl}/api/feeds/all.xml`;
};

/**
 * Copie l'URL du flux dans le presse-papier
 */
export const copyFeedUrl = async (category?: string): Promise<void> => {
  const url = getFeedUrl(category);
  await navigator.clipboard.writeText(url);
};
