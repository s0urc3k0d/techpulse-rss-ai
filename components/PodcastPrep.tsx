import React, { useState } from 'react';
import { importLegacyXmlFeed, triggerSaturdayPodcastDigest } from '../services/apiService';

interface PreparedArticle {
  url: string;
  title: string;
  catchyTitle: string;
  bulletPoints: string[];
  summary: string;
  error?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const PodcastPrep: React.FC = () => {
  const [urls, setUrls] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<PreparedArticle[]>([]);
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<string>('');
  const [isTriggeringSaturdayDigest, setIsTriggeringSaturdayDigest] = useState(false);
  const [saturdayDigestMessage, setSaturdayDigestMessage] = useState<string>('');
  const [xmlImportUrl, setXmlImportUrl] = useState('');
  const [isImportingXml, setIsImportingXml] = useState(false);
  const [xmlImportMessage, setXmlImportMessage] = useState('');
  const [jsonFileName, setJsonFileName] = useState('');

  const handleTriggerSaturdayDigest = async () => {
    setIsTriggeringSaturdayDigest(true);
    setSaturdayDigestMessage('');
    setError('');

    try {
      const response = await triggerSaturdayPodcastDigest();
      setSaturdayDigestMessage(response.note || response.message || 'Récap du samedi déclenché.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du déclenchement du récap du samedi');
    } finally {
      setIsTriggeringSaturdayDigest(false);
    }
  };

  const handlePrepare = async () => {
    const urlList = urls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0 && u.startsWith('http'));

    if (urlList.length === 0) {
      setError('Veuillez entrer au moins une URL valide');
      return;
    }

    if (urlList.length > 20) {
      setError('Maximum 20 URLs à la fois');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResults([]);
    setProgress(`Analyse de ${urlList.length} article${urlList.length > 1 ? 's' : ''}...`);

    try {
      const response = await fetch(`${API_BASE_URL}/prepare-podcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      setResults(data.articles);
      setProgress('');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
      setProgress('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportLegacyXml = async () => {
    const trimmedUrl = xmlImportUrl.trim();

    if (!trimmedUrl) {
      setError('Veuillez entrer une URL XML valide');
      return;
    }

    setIsImportingXml(true);
    setXmlImportMessage('');
    setError('');

    try {
      const response = await importLegacyXmlFeed({
        xmlUrl: trimmedUrl,
        savedBy: 'manual',
      });

      setXmlImportMessage(
        `Import terminé : ${response.saved} ajouté(s), ${response.duplicates} doublon(s) sur ${response.imported} article(s).`
      );
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'import du flux XML");
    } finally {
      setIsImportingXml(false);
    }
  };

  const handleImportJsonFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setJsonFileName(file.name);
    setIsImportingXml(true);
    setXmlImportMessage('');
    setError('');

    try {
      const jsonText = await file.text();

      try {
        JSON.parse(jsonText);
      } catch {
        throw new Error('Le fichier sélectionné ne contient pas un JSON valide');
      }

      const response = await importLegacyXmlFeed({
        jsonContent: jsonText,
        sourceFormat: 'json',
        savedBy: 'manual',
      });

      setXmlImportMessage(
        `Import ${response.format?.toUpperCase() || 'JSON'} terminé : ${response.saved} ajouté(s), ${response.duplicates} doublon(s) sur ${response.imported} article(s).`
      );
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'import du fichier JSON");
    } finally {
      setIsImportingXml(false);
      event.target.value = '';
    }
  };

  const copyAllToClipboard = () => {
    const text = results
      .filter(r => !r.error)
      .map((article, idx) => {
        return `## ${idx + 1}. ${article.catchyTitle}

${article.bulletPoints.map(bp => `• ${bp}`).join('\n')}

${article.summary}

🔗 ${article.url}`;
      })
      .join('\n\n---\n\n');

    navigator.clipboard.writeText(text);
    alert('Script copié dans le presse-papier !');
  };

  const copyOneToClipboard = (article: PreparedArticle) => {
    const text = `## ${article.catchyTitle}

${article.bulletPoints.map(bp => `• ${bp}`).join('\n')}

${article.summary}

🔗 ${article.url}`;

    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-surface rounded-lg p-6 border border-slate-700">
        <h2 className="text-lg font-semibold mb-4 text-slate-200 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Coller vos liens d'articles
        </h2>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleTriggerSaturdayDigest}
            disabled={isTriggeringSaturdayDigest}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              isTriggeringSaturdayDigest
                ? 'bg-slate-600 text-slate-300 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {isTriggeringSaturdayDigest ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Déclenchement...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.79-3 4s1.343 4 3 4 3-1.79 3-4-1.343-4-3-4zm0 0V4m0 12v4m8-8h-4M8 12H4" />
                </svg>
                Envoyer le récap du samedi maintenant
              </>
            )}
          </button>

          {saturdayDigestMessage && (
            <span className="text-sm text-emerald-300">{saturdayDigestMessage}</span>
          )}
        </div>

        <div className="mb-4 rounded-lg border border-slate-700 bg-dark/40 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <input
              type="url"
              value={xmlImportUrl}
              onChange={(e) => setXmlImportUrl(e.target.value)}
              placeholder="URL de l'ancien flux XML (https://...)"
              className="w-full sm:flex-1 bg-dark border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isImportingXml}
            />
            <button
              onClick={handleImportLegacyXml}
              disabled={isImportingXml}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isImportingXml
                  ? 'bg-slate-600 text-slate-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              {isImportingXml ? 'Import...' : 'Importer XML'}
            </button>
            <label
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                isImportingXml
                  ? 'bg-slate-600 text-slate-300 cursor-not-allowed pointer-events-none'
                  : 'bg-violet-600 hover:bg-violet-500 text-white'
              }`}
            >
              Importer fichier JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportJsonFile}
                disabled={isImportingXml}
                className="hidden"
              />
            </label>
          </div>
          {jsonFileName && (
            <p className="mt-2 text-xs text-slate-400">Fichier sélectionné : {jsonFileName}</p>
          )}
          {xmlImportMessage && (
            <p className="mt-2 text-sm text-emerald-300">{xmlImportMessage}</p>
          )}
        </div>
        
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="Collez vos liens ici (un par ligne)...

https://example.com/article-1
https://example.com/article-2
https://example.com/article-3"
          className="w-full h-48 bg-dark border border-slate-600 rounded-lg p-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none font-mono text-sm"
          disabled={isProcessing}
        />
        
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-slate-400">
            {urls.split('\n').filter(u => u.trim().startsWith('http')).length} lien(s) détecté(s) • Max 20
          </div>
          
          <button
            onClick={handlePrepare}
            disabled={isProcessing || urls.trim().length === 0}
            className={`
              px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center gap-2
              ${isProcessing || urls.trim().length === 0
                ? 'bg-slate-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary to-secondary hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99]'}
            `}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {progress}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Préparer le Podcast
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">
              Script Podcast 
              <span className="text-slate-500 text-lg font-normal ml-2">
                ({results.filter(r => !r.error).length} article{results.filter(r => !r.error).length > 1 ? 's' : ''})
              </span>
            </h2>
            
            <button
              onClick={copyAllToClipboard}
              className="bg-secondary hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copier tout
            </button>
          </div>

          <div className="space-y-6">
            {results.map((article, idx) => (
              <div 
                key={idx} 
                className={`bg-surface border rounded-lg p-6 relative ${
                  article.error ? 'border-red-500/50 bg-red-900/10' : 'border-slate-700'
                }`}
              >
                {/* Number badge */}
                <div className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white border-4 border-dark ${
                  article.error ? 'bg-red-500' : 'bg-primary'
                }`}>
                  {idx + 1}
                </div>

                {article.error ? (
                  <div className="text-red-300">
                    <div className="font-medium">Erreur: {article.error}</div>
                    <div className="text-sm text-slate-400 mt-1 break-all">{article.url}</div>
                  </div>
                ) : (
                  <>
                    {/* Catchy Title */}
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-primary">{article.catchyTitle}</h3>
                      {article.title !== article.catchyTitle && (
                        <div className="text-sm text-slate-500 mt-1">
                          Original: {article.title}
                        </div>
                      )}
                    </div>

                    {/* Bullet Points */}
                    <ul className="space-y-2 mb-4">
                      {article.bulletPoints.map((point, pIdx) => (
                        <li key={pIdx} className="flex items-start gap-3 text-slate-300">
                          <svg className="w-5 h-5 text-secondary shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Summary */}
                    <div className="bg-dark/50 rounded-lg p-4 mb-4">
                      <div className="text-sm font-medium text-slate-400 mb-2">Résumé oral :</div>
                      <p className="text-slate-200 italic">"{article.summary}"</p>
                    </div>

                    {/* URL */}
                    <div className="flex items-center justify-between text-sm border-t border-slate-700 pt-4">
                      <a 
                        href={article.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 truncate max-w-[80%]"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {article.url}
                      </a>
                      
                      <button
                        onClick={() => copyOneToClipboard(article)}
                        className="text-slate-400 hover:text-white transition-colors p-2"
                        title="Copier cet article"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Summary of all titles at the bottom */}
          {results.filter(r => !r.error).length > 0 && (
            <div className="bg-surface border border-slate-700 rounded-lg p-6 mt-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Récap des titres
                </h3>
                <button
                  onClick={() => {
                    const text = results
                      .filter(r => !r.error)
                      .map((a, i) => `${i + 1}. ${a.catchyTitle}`)
                      .join('\n');
                    navigator.clipboard.writeText(text);
                  }}
                  className="text-slate-400 hover:text-white transition-colors p-2"
                  title="Copier la liste"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <ol className="space-y-2">
                {results.filter(r => !r.error).map((article, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="bg-primary/20 text-primary font-bold text-sm px-2 py-0.5 rounded shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-slate-300">{article.catchyTitle}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !isProcessing && !error && (
        <div className="text-center py-16 text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p className="text-lg">Collez vos liens d'articles ci-dessus</p>
          <p className="text-sm mt-2">L'IA générera un script prêt pour votre podcast</p>
        </div>
      )}
    </div>
  );
};
