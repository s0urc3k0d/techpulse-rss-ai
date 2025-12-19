export interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
  isoDate: Date;
}

export enum Category {
  HARDWARE = "Hardware",
  GAMING = "Jeux Vidéo",
  AI = "IA & Data",
  SOFTWARE = "Software & Apps",
  SECURITY = "Cybersécurité",
  BUSINESS = "Business Tech",
  MOBILE = "Mobile & Telecom",
  SCIENCE = "Science & Espace",
  OTHER = "Autre"
}

export interface ProcessedArticle extends RSSItem {
  id: string;
  category: Category;
  summary?: string;
}

export interface ProcessingStatus {
  total: number;
  processed: number;
  stage: 'idle' | 'fetching' | 'filtering' | 'analyzing' | 'generating_script' | 'complete' | 'error';
  message?: string;
}

export interface PodcastScriptItem {
  originalId: string;
  catchyTitle: string;
  keyPoints: string[];
}
