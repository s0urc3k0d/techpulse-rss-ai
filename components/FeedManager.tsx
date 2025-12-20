import React, { useState } from 'react';

interface FeedManagerProps {
  feeds: string[];
  onAddFeed: (url: string) => void;
  onRemoveFeed: (url: string) => void;
  onResetFeeds?: () => void;
  onBulkImport?: (urls: string[]) => void;
}

export const FeedManager: React.FC<FeedManagerProps> = ({ 
  feeds, 
  onAddFeed, 
  onRemoveFeed, 
  onResetFeeds,
  onBulkImport 
}) => {
  const [newUrl, setNewUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkUrls, setBulkUrls] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl && !feeds.includes(newUrl)) {
      onAddFeed(newUrl);
      setNewUrl('');
    }
  };

  const handleBulkImportSubmit = () => {
    if (!onBulkImport) return;
    
    const urls = bulkUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url && url.startsWith('http'));
    
    if (urls.length > 0) {
      onBulkImport(urls);
      setBulkUrls('');
      setShowBulkImport(false);
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

          <div className="flex gap-2 mb-3">
            {onBulkImport && (
              <button
                onClick={() => setShowBulkImport(!showBulkImport)}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded text-sm transition-colors font-medium"
              >
                {showBulkImport ? 'Annuler' : 'Import en masse'}
              </button>
            )}
            {onResetFeeds && (
              <button
                onClick={onResetFeeds}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded text-sm transition-colors"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {showBulkImport && (
            <div className="mb-4 p-4 bg-surface border border-slate-600 rounded">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Import en masse (une URL par ligne)
              </label>
              <textarea
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                placeholder="https://site1.com/rss&#10;https://site2.com/feed&#10;https://site3.com/rss"
                className="w-full h-32 bg-dark border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none font-mono resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleBulkImportSubmit}
                  className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                >
                  Importer {bulkUrls.split('\n').filter(u => u.trim().startsWith('http')).length} flux
                </button>
                <button
                  onClick={() => { setBulkUrls(''); setShowBulkImport(false); }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded text-sm transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

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
