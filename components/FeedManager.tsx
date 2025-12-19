import React, { useState } from 'react';

interface FeedManagerProps {
  feeds: string[];
  onAddFeed: (url: string) => void;
  onRemoveFeed: (url: string) => void;
  onResetFeeds?: () => void;
}

export const FeedManager: React.FC<FeedManagerProps> = ({ feeds, onAddFeed, onRemoveFeed, onResetFeeds }) => {
  const [newUrl, setNewUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl && !feeds.includes(newUrl)) {
      onAddFeed(newUrl);
      setNewUrl('');
    }
  };

  return (
    <div className="bg-surface rounded-lg border border-slate-700 overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 hover:bg-slate-700/50 transition-colors text-left"
      >
        <span className="font-semibold text-slate-200">
          Sources RSS ({feeds.length})
        </span>
        <svg 
          className={`w-5 h-5 text-slate-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-700 bg-dark/30">
          <form onSubmit={handleAdd} className="flex gap-2 mb-4">
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://site.com/rss"
              className="flex-1 bg-dark border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
              required
            />
            <button
              type="submit"
              className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              Ajouter
            </button>
          </form>

          {onResetFeeds && (
            <button
              onClick={onResetFeeds}
              className="w-full mb-3 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded text-sm transition-colors"
            >
              Réinitialiser aux flux par défaut
            </button>
          )}

          <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {feeds.map((url) => (
              <li key={url} className="flex justify-between items-center text-sm bg-surface p-2 rounded border border-slate-700/50">
                <span className="truncate text-slate-300 mr-2 flex-1" title={url}>{url}</span>
                <button
                  onClick={() => onRemoveFeed(url)}
                  className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-900/20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
