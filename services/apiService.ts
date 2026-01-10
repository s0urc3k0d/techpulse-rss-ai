import { RSSItem, ProcessedArticle, Category, PodcastScriptItem } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface CategorizeResponse {
  success: boolean;
  classifications: Array<{
    id: string;
    category: Category;
  }>;
}

interface GenerateScriptResponse {
  success: boolean;
  scriptItems: PodcastScriptItem[];
}

const BATCH_SIZE = 100; // Max articles per API request

// Helper to process a single batch
const categorizeBatch = async (
  batch: Array<RSSItem & { id: string }>
): Promise<Map<string, Category>> => {
  const response = await fetch(`${API_BASE_URL}/categorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      articles: batch.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description.substring(0, 150)
      }))
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `HTTP error ${response.status}`);
  }

  const data: CategorizeResponse = await response.json();
  
  if (!data.success || !data.classifications) {
    throw new Error('Invalid response from API');
  }

  const classificationMap = new Map<string, Category>();
  data.classifications.forEach((item) => {
    classificationMap.set(item.id, item.category);
  });
  
  return classificationMap;
};

export const categorizeArticles = async (
  articles: RSSItem[]
): Promise<ProcessedArticle[]> => {
  if (articles.length === 0) return [];

  // Generate unique IDs for mapping
  const articlesWithId = articles.map((a, index) => ({
    ...a,
    id: `art_${index}`
  }));

  try {
    const totalBatches = Math.ceil(articlesWithId.length / BATCH_SIZE);
    console.log(`Categorizing ${articlesWithId.length} articles in ${totalBatches} batch(es)...`);
    
    // Split into batches and process
    const allClassifications = new Map<string, Category>();
    
    for (let i = 0; i < articlesWithId.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const batch = articlesWithId.slice(i, i + BATCH_SIZE);
      
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} articles)...`);
      
      const batchResults = await categorizeBatch(batch);
      batchResults.forEach((category, id) => {
        allClassifications.set(id, category);
      });
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < articlesWithId.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Categorization complete: ${allClassifications.size} articles classified`);

    // Merge results
    return articlesWithId.map(article => ({
      ...article,
      category: allClassifications.get(article.id) || Category.OTHER
    }));

  } catch (error) {
    console.error("AI classification failed:", error);
    // Fallback: mark all as Other if AI fails
    return articlesWithId.map(a => ({ ...a, category: Category.OTHER }));
  }
};

export const generatePodcastScript = async (
  articles: ProcessedArticle[]
): Promise<PodcastScriptItem[]> => {
  if (articles.length === 0) return [];

  try {
    console.log(`Generating podcast script for ${articles.length} articles...`);
    
    const response = await fetch(`${API_BASE_URL}/generate-script`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        articles: articles.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          source: a.source
        }))
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Script generation error response:', error);
      throw new Error(error.error || `HTTP error ${response.status}`);
    }

    const data: GenerateScriptResponse = await response.json();
    
    console.log('Script generation response:', data);
    
    if (!data.success || !data.scriptItems) {
      throw new Error('Invalid response from API');
    }

    return data.scriptItems;

  } catch (error) {
    console.error("Podcast script generation failed:", error);
    throw error; // Re-throw pour que l'erreur soit visible
  }
};
