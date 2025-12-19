import { ProcessedArticle } from '../types';

/**
 * Simple fuzzy search implementation
 * Scores based on:
 * - Exact matches (highest score)
 * - Word boundary matches
 * - Partial matches
 * - Case-insensitive matching
 */
export const fuzzySearch = (articles: ProcessedArticle[], query: string): ProcessedArticle[] => {
  if (!query.trim()) {
    return articles;
  }

  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/);

  const scoredArticles = articles.map(article => {
    const title = article.title.toLowerCase();
    const description = (article.description || '').toLowerCase();
    const source = article.source.toLowerCase();
    const searchText = `${title} ${description} ${source}`;

    let score = 0;

    // Exact phrase match (highest score)
    if (searchText.includes(normalizedQuery)) {
      score += 100;
      // Bonus if in title
      if (title.includes(normalizedQuery)) {
        score += 50;
      }
    }

    // Word-based scoring
    queryWords.forEach(word => {
      if (word.length < 2) return;

      // Exact word match
      const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
      if (wordRegex.test(searchText)) {
        score += 30;
        if (wordRegex.test(title)) {
          score += 20; // Bonus for title match
        }
      } 
      // Partial match
      else if (searchText.includes(word)) {
        score += 10;
        if (title.includes(word)) {
          score += 5;
        }
      }
    });

    // Word start match bonus
    queryWords.forEach(word => {
      if (word.length < 2) return;
      const words = searchText.split(/\s+/);
      words.forEach(w => {
        if (w.startsWith(word)) {
          score += 5;
        }
      });
    });

    return { article, score };
  });

  // Filter out zero scores and sort by score descending
  return scoredArticles
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.article);
};

/**
 * Get search statistics
 */
export const getSearchStats = (
  totalArticles: number,
  filteredArticles: number,
  query: string
): string => {
  if (!query.trim()) {
    return `${totalArticles} article${totalArticles > 1 ? 's' : ''}`;
  }
  
  if (filteredArticles === 0) {
    return `Aucun résultat pour "${query}"`;
  }
  
  return `${filteredArticles} résultat${filteredArticles > 1 ? 's' : ''} sur ${totalArticles}`;
};
