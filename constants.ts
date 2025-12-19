import { Category } from './types';

export const DEFAULT_FEEDS = [
  "https://www.frandroid.com/feed",
  "https://www.numerama.com/feed/",
  "https://korben.info/feed",
  "https://news.ycombinator.com/rss",
  "https://www.theverge.com/rss/index.xml"
];

export const CATEGORY_COLORS: Record<Category, string> = {
  [Category.HARDWARE]: "bg-orange-500/20 text-orange-300 border-orange-500/50",
  [Category.GAMING]: "bg-purple-500/20 text-purple-300 border-purple-500/50",
  [Category.AI]: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
  [Category.SOFTWARE]: "bg-blue-500/20 text-blue-300 border-blue-500/50",
  [Category.SECURITY]: "bg-red-500/20 text-red-300 border-red-500/50",
  [Category.BUSINESS]: "bg-slate-500/20 text-slate-300 border-slate-500/50",
  [Category.MOBILE]: "bg-pink-500/20 text-pink-300 border-pink-500/50",
  [Category.SCIENCE]: "bg-cyan-500/20 text-cyan-300 border-cyan-500/50",
  [Category.OTHER]: "bg-gray-500/20 text-gray-300 border-gray-500/50",
};
