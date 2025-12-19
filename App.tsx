import React, { useState, useEffect, useMemo } from 'react';
import { fetchAndParseRSS } from './services/rssService';
import { categorizeArticles, generatePodcastScript } from './services/geminiService';
import { DEFAULT_FEEDS, CATEGORY_COLORS } from './constants';
import { RSSItem, ProcessedArticle, ProcessingStatus, Category, PodcastScriptItem } from './types';
import { FeedManager } from './components/FeedManager';
import { DateSelector } from './components/DateSelector';
import { ArticleCard } from './components/ArticleCard';

// Helper to format date for input type='date' (YYYY-MM-DD)
const formatDateForInput = (date: Date) => date.toISOString().split('T')[0];

const App: React.FC = () => {
  const [feeds, setFeeds] = useState<string[]>(DEFAULT_FEEDS);
  const [startDate, setStartDate] = useState(formatDateForInput(new Date()));
  const [endDate, setEndDate] = useState(formatDateForInput(new Date()));
  
  const [articles, setArticles] = useState<ProcessedArticle[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ total: 0, processed: 0, stage: 'idle' });
  const [selectedTag, setSelectedTag] = useState<Category | 'All'>('All');

  // New state for selection and podcast generation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [podcastScript, setPodcastScript] = useState<PodcastScriptItem[]>([]);
  const [showScriptModal, setShowScriptModal] = useState(false);

  const handleAddFeed = (url: string) => setFeeds(prev => [...prev, url]);
  const handleRemoveFeed = (url: string) => setFeeds(prev => prev.filter(f => f !== url));

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setPodcastScript([]);
  };

  const runScraper = async () => {
    setStatus({ total: 0, processed: 0, stage: 'fetching' });
    setArticles([]);
    setSelectedIds(new Set());
    setPodcastScript([]);

    try {
      // 1. Fetch all feeds
      const allItems: RSSItem[] = [];
      let feedsFetched = 0;

      for (const url of feeds) {
        const feedItems = await fetchAndParseRSS(url);
        allItems.push(...feedItems);
        feedsFetched++;
        setStatus({ 
          total: feeds.length, 
          processed: feedsFetched, 
          stage: 'fetching',
          message: `Récupération de ${feedsFetched}/${feeds.length} flux...`
        });
      }

      // 2. Filter by date locally immediately
      setStatus({ ...status, stage: 'filtering', message: 'Filtrage par date...' });
      
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const filteredItems = allItems.filter(item => {
        return item.isoDate >= start && item.isoDate <= end;
      });

      if (filteredItems.length === 0) {
        setStatus({ total: 0, processed: 0, stage: 'complete', message: 'Aucun article trouvé pour cette période.' });
        return;
      }

      // 3. AI Categorization
      setStatus({ 
        total: filteredItems.length, 
        processed: 0, 
        stage: 'analyzing', 
        message: `Analyse de ${filteredItems.length} articles avec Gemini...` 
      });

      const categorized = await categorizeArticles(filteredItems);

      setArticles(categorized);
      setStatus({ total: filteredItems.length, processed: filteredItems.length, stage: 'complete' });

    } catch (error) {
      console.error(error);
      setStatus({ total: 0, processed: 0, stage: 'error', message: 'Une erreur est survenue lors du traitement.' });
    }
  };

  const handleGeneratePodcast = async () => {
    if (selectedIds.size === 0) return;

    setStatus({ ...status, stage: 'generating_script', message: 'Génération du script podcast...' });
    
    const selectedArticles = articles.filter(a => selectedIds.has(a.id));
    try {
      const script = await generatePodcastScript(selectedArticles);
      setPodcastScript(script);
      setShowScriptModal(true);
      setStatus({ ...status, stage: 'complete' });
    } catch (e) {
      console.error(e);
      setStatus({ ...status, stage: 'error', message: "Erreur lors de la génération du script" });
    }
  };

  const filteredArticles = useMemo(() => {
    if (selectedTag === 'All') return articles;
    return articles.filter(a => a.category === selectedTag);
  }, [articles, selectedTag]);

  // Group stats for the dashboard
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach(a => {
      counts[a.category] = (counts[a.category] || 0) + 1;
    });
    return counts;
  }, [articles]);

  return (
    <div className="min-h-screen bg-dark text-slate-100 font-sans pb-32">
      {/* Header */}
      <header className="border-b border-slate-700 bg-surface/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              TechPulse AI
            </h1>
          </div>
          
          <div className="text-sm text-slate-400 hidden sm:block">
             Powered by Google Gemini
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        
        {/* Controls Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <FeedManager 
              feeds={feeds} 
              onAddFeed={handleAddFeed} 
              onRemoveFeed={handleRemoveFeed} 
            />
          </div>
          
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-surface rounded-lg p-6 border border-slate-700">
              <h2 className="text-lg font-semibold mb-4 text-slate-200">Configuration du Scraping</h2>
              <div className="flex flex-col gap-6">
                <DateSelector 
                  startDate={startDate} 
                  endDate={endDate} 
                  onStartDateChange={setStartDate} 
                  onEndDateChange={setEndDate} 
                />
                
                <button
                  onClick={runScraper}
                  disabled={status.stage === 'fetching' || status.stage === 'analyzing' || status.stage === 'generating_script'}
                  className={`
                    w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all
                    flex justify-center items-center gap-2
                    ${['fetching', 'analyzing', 'generating_script'].includes(status.stage)
                      ? 'bg-slate-600 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-primary to-secondary hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99]'}
                  `}
                >
                  {['fetching', 'analyzing', 'generating_script'].includes(status.stage) ? (
                    <>
                       <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                       {status.message}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Lancer l'analyse
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Results Section */}
        {articles.length > 0 && (
          <section className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pb-4 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white">
                Articles du jour <span className="text-slate-500 text-lg font-normal">({articles.length})</span>
              </h2>
              
              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                <button
                  onClick={() => setSelectedTag('All')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    selectedTag === 'All' 
                      ? 'bg-white text-black border-white' 
                      : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  Tout voir
                </button>
                {Object.values(Category).map(cat => {
                  const count = stats[cat] || 0;
                  if (count === 0) return null;
                  
                  // Extract colors for active state
                  const activeClass = CATEGORY_COLORS[cat];

                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedTag(cat)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border flex items-center gap-2 ${
                        selectedTag === cat 
                          ? activeClass 
                          : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      {cat}
                      <span className="bg-dark/30 px-1.5 rounded-full text-xs">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredArticles.map((article) => (
                <ArticleCard 
                  key={article.id} 
                  article={article} 
                  isSelected={selectedIds.has(article.id)}
                  onToggle={() => toggleSelection(article.id)}
                />
              ))}
            </div>
            
            {filteredArticles.length === 0 && (
               <div className="text-center py-20 text-slate-500">
                 Aucun article trouvé pour cette catégorie.
               </div>
            )}
          </section>
        )}
        
        {status.stage === 'error' && (
          <div className="p-4 bg-red-900/20 border border-red-500/50 rounded text-red-200 text-center">
            {status.message}
          </div>
        )}

      </main>

      {/* Floating Action Bar for Selection */}
      {selectedIds.size > 0 && !showScriptModal && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-surface/90 backdrop-blur-md border border-slate-600 rounded-full shadow-2xl px-6 py-3 flex items-center gap-4 animate-bounce-in">
          <div className="text-sm font-semibold text-white">
            <span className="text-primary font-bold text-lg mr-1">{selectedIds.size}</span>
            sélectionnés
          </div>
          <div className="h-6 w-px bg-slate-600"></div>
          <button 
            onClick={clearSelection}
            className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
          >
            Annuler
          </button>
          <button 
            onClick={handleGeneratePodcast}
            disabled={status.stage === 'generating_script'}
            className="bg-primary hover:bg-blue-600 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
          >
             {status.stage === 'generating_script' ? (
               <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             ) : (
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
             )}
            Générer le Script
          </button>
        </div>
      )}

      {/* Podcast Script Modal */}
      {showScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-slate-600 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                Script Podcast ({podcastScript.length} sujets)
              </h3>
              <button onClick={() => setShowScriptModal(false)} className="text-slate-400 hover:text-white p-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 space-y-8 bg-dark/50">
              {podcastScript.map((item, idx) => {
                const original = articles.find(a => a.id === item.originalId);
                return (
                  <div key={idx} className="bg-surface border border-slate-700 p-6 rounded-lg relative">
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary rounded-full flex items-center justify-center font-bold text-white border-4 border-dark">
                      {idx + 1}
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="text-xl font-bold text-primary mb-1">{item.catchyTitle}</h4>
                      <div className="text-xs text-slate-500 uppercase tracking-wide">
                        Source: {original?.source} | <a href={original?.link} target="_blank" className="hover:underline">Article original</a>
                      </div>
                    </div>

                    <ul className="space-y-2">
                      {item.keyPoints.map((point, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-3 text-slate-300">
                          <svg className="w-5 h-5 text-secondary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="p-6 border-t border-slate-700 bg-surface flex justify-end gap-3">
               <button 
                onClick={() => setShowScriptModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white font-medium"
              >
                Fermer
              </button>
              <button 
                onClick={() => {
                   const text = podcastScript.map((item, i) => 
                     `#${i+1} ${item.catchyTitle}\n\n${item.keyPoints.map(p => `- ${p}`).join('\n')}`
                   ).join('\n\n---\n\n');
                   navigator.clipboard.writeText(text);
                   alert("Script copié dans le presse-papier !");
                }}
                className="bg-secondary hover:bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                Copier le texte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
