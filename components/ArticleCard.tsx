import React from 'react';
import { ProcessedArticle, Category } from '../types';
import { CATEGORY_COLORS } from '../constants';

interface ArticleCardProps {
  article: ProcessedArticle;
  isSelected: boolean;
  onToggle: () => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, isSelected, onToggle }) => {
  const categoryStyle = CATEGORY_COLORS[article.category] || CATEGORY_COLORS[Category.OTHER];

  return (
    <article 
      className={`group relative rounded-lg border transition-all duration-300 flex flex-col h-full overflow-hidden shadow-sm hover:shadow-md 
      ${isSelected 
        ? 'bg-blue-900/20 border-primary ring-1 ring-primary' 
        : 'bg-surface border-slate-700 hover:border-slate-500 hover:shadow-blue-900/10'
      }`}
    >
      {/* Checkbox Overlay Area */}
      <div className="absolute top-4 right-4 z-10">
        <label className="relative flex items-center justify-center cursor-pointer group-checkbox">
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={onToggle}
            className="peer sr-only"
          />
          <div className={`w-6 h-6 rounded border-2 transition-all flex items-center justify-center
            ${isSelected 
              ? 'bg-primary border-primary text-white' 
              : 'bg-dark/50 border-slate-500 hover:border-slate-300'
            }`}
          >
            {isSelected && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </label>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-3 gap-2 pr-8">
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded border ${categoryStyle}`}>
            {article.category}
          </span>
        </div>
        
        <div className="mb-1">
            <span className="text-slate-500 text-xs whitespace-nowrap">
            {article.isoDate.toLocaleDateString('fr-FR')}
          </span>
        </div>

        <h3 className="text-lg font-bold text-slate-100 mb-2 leading-snug group-hover:text-primary transition-colors cursor-pointer" onClick={onToggle}>
            {article.title}
        </h3>
        
        <p className="text-slate-400 text-sm mb-4 line-clamp-3 flex-1 cursor-pointer" onClick={onToggle}>
          {article.description}
        </p>
        
        <div className="mt-auto pt-4 border-t border-slate-700/50 flex justify-between items-center">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            {article.source}
          </span>
          <a 
            href={article.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary text-sm font-semibold hover:underline flex items-center gap-1 z-20 relative"
            onClick={(e) => e.stopPropagation()} // Prevent triggering the card click (checkbox)
          >
            Lire
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </a>
        </div>
      </div>
    </article>
  );
};
