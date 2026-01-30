import React, { useState, useEffect } from 'react';
import { 
  getFeedStats, 
  getFeedUrl, 
  copyFeedUrl,
  FeedStats,
  FeedCategory 
} from '../services/feedExportService';

interface BlogFeedManagerProps {
  onClose?: () => void;
}

export const BlogFeedManager: React.FC<BlogFeedManagerProps> = ({ onClose }) => {
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [categories, setCategories] = useState<FeedCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getFeedStats();
      setStats(data.stats);
      setCategories(data.categories);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async (category?: string) => {
    try {
      await copyFeedUrl(category);
      setCopiedUrl(category || 'all');
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Erreur copie URL:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-green-500/10 to-emerald-500/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-white">Flux RSS pour Blog</h3>
            <p className="text-xs text-slate-400">Articles exportés pour ton RSS Parser</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Stats globales */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.totalSaved}</div>
              <div className="text-xs text-slate-400">Articles</div>
            </div>
            <div className="bg-dark/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-400">{Object.keys(stats.byCategory).length}</div>
              <div className="text-xs text-slate-400">Catégories</div>
            </div>
            <div className="bg-dark/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-400">{Object.keys(stats.bySource).length}</div>
              <div className="text-xs text-slate-400">Sources</div>
            </div>
          </div>
        )}

        {/* Flux principal */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Flux RSS Global</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={getFeedUrl()}
              className="flex-1 bg-dark border border-slate-600 rounded px-3 py-2 text-sm text-slate-300 font-mono"
            />
            <button
              onClick={() => handleCopyUrl()}
              className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                copiedUrl === 'all'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
            >
              {copiedUrl === 'all' ? '✓ Copié' : 'Copier'}
            </button>
            <a
              href={getFeedUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
            >
              Ouvrir
            </a>
          </div>
        </div>

        {/* Flux par catégorie */}
        {categories.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Flux par Catégorie</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.slug} className="flex items-center gap-2 bg-dark/30 rounded p-2">
                  <span className="flex-1 text-sm text-slate-300">
                    {cat.name} <span className="text-slate-500">({cat.count})</span>
                  </span>
                  <button
                    onClick={() => handleCopyUrl(cat.slug)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                      copiedUrl === cat.slug
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    {copiedUrl === cat.slug ? '✓' : 'Copier URL'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dernière mise à jour */}
        {stats && (
          <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
            Dernière mise à jour: {formatDate(stats.lastUpdated)}
          </div>
        )}

        {/* Message si vide */}
        {stats && stats.totalSaved === 0 && (
          <div className="text-center py-4 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p>Aucun article sauvegardé</p>
            <p className="text-sm mt-1">Sélectionne des articles et clique sur "Sauvegarder pour Blog"</p>
          </div>
        )}
      </div>
    </div>
  );
};
