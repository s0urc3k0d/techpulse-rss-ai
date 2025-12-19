import { ProcessedArticle, PodcastScriptItem } from '../types';

/**
 * Export articles to CSV format
 */
export const exportToCSV = (articles: ProcessedArticle[]): string => {
  const headers = ['Titre', 'Description', 'Lien', 'Source', 'Date', 'Catégorie'];
  const rows = articles.map(article => [
    escapeCSV(article.title),
    escapeCSV(article.description || ''),
    escapeCSV(article.link),
    escapeCSV(article.source),
    article.isoDate.toISOString(),
    article.category
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
};

/**
 * Export articles to JSON format
 */
export const exportToJSON = (articles: ProcessedArticle[]): string => {
  const exportData = {
    exportDate: new Date().toISOString(),
    totalArticles: articles.length,
    articles: articles.map(article => ({
      id: article.id,
      title: article.title,
      description: article.description,
      link: article.link,
      source: article.source,
      date: article.isoDate.toISOString(),
      category: article.category
    }))
  };

  return JSON.stringify(exportData, null, 2);
};

/**
 * Export articles to Markdown format
 */
export const exportToMarkdown = (articles: ProcessedArticle[]): string => {
  const date = new Date().toLocaleDateString('fr-FR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  let markdown = `# Export TechPulse AI\n\n`;
  markdown += `**Date d'export**: ${date}\n`;
  markdown += `**Nombre d'articles**: ${articles.length}\n\n`;
  markdown += `---\n\n`;

  // Group by category
  const grouped = articles.reduce((acc, article) => {
    if (!acc[article.category]) acc[article.category] = [];
    acc[article.category].push(article);
    return acc;
  }, {} as Record<string, ProcessedArticle[]>);

  Object.entries(grouped).forEach(([category, items]) => {
    markdown += `## ${category} (${items.length})\n\n`;
    
    items.forEach(article => {
      markdown += `### ${article.title}\n\n`;
      if (article.description) {
        markdown += `${article.description}\n\n`;
      }
      markdown += `**Source**: ${article.source}  \n`;
      markdown += `**Date**: ${article.isoDate.toLocaleDateString('fr-FR')}  \n`;
      markdown += `**Lien**: [${article.link}](${article.link})\n\n`;
      markdown += `---\n\n`;
    });
  });

  return markdown;
};

/**
 * Export podcast script to Markdown
 */
export const exportPodcastScriptToMarkdown = (script: PodcastScriptItem[]): string => {
  const date = new Date().toLocaleDateString('fr-FR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  let markdown = `# Script Podcast TechPulse\n\n`;
  markdown += `**Date**: ${date}\n`;
  markdown += `**Nombre de segments**: ${script.length}\n\n`;
  markdown += `---\n\n`;

  script.forEach((item, index) => {
    markdown += `## Segment ${index + 1}: ${item.title}\n\n`;
    markdown += `**Catégorie**: ${item.category}\n\n`;
    markdown += `### Script\n\n${item.script}\n\n`;
    markdown += `**Sources**:\n`;
    item.sources.forEach(source => {
      markdown += `- [${source}](${source})\n`;
    });
    markdown += `\n---\n\n`;
  });

  return markdown;
};

/**
 * Download file helper
 */
export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Generate filename with timestamp
 */
export const generateFilename = (prefix: string, extension: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}_${timestamp}.${extension}`;
};

/**
 * Escape CSV field
 */
const escapeCSV = (field: string): string => {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};

/**
 * Export handlers with toast notifications
 */
export const handleExportCSV = (articles: ProcessedArticle[]) => {
  const csv = exportToCSV(articles);
  downloadFile(csv, generateFilename('techpulse_articles', 'csv'), 'text/csv');
};

export const handleExportJSON = (articles: ProcessedArticle[]) => {
  const json = exportToJSON(articles);
  downloadFile(json, generateFilename('techpulse_articles', 'json'), 'application/json');
};

export const handleExportMarkdown = (articles: ProcessedArticle[]) => {
  const markdown = exportToMarkdown(articles);
  downloadFile(markdown, generateFilename('techpulse_articles', 'md'), 'text/markdown');
};

export const handleExportPodcastScript = (script: PodcastScriptItem[]) => {
  const markdown = exportPodcastScriptToMarkdown(script);
  downloadFile(markdown, generateFilename('techpulse_podcast', 'md'), 'text/markdown');
};
