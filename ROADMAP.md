# Roadmap — TechPulse AI

> Analyse complète du projet : priorisations techniques, UX, performance et sécurité (Déc. 2025)

---

## 🔴 Priorité CRITIQUE (Sécurité & Blocage production)

### 1. Sécurité : Migrer Gemini API côté serveur 🔒

**Problème**: `vite.config.ts` expose `GEMINI_API_KEY` via `process.env.API_KEY` directement dans le bundle client, rendant la clé visible dans le code source. `@google/genai` est importé côté client via ESM CDN.

**Impact**: Clé API publique = quota épuisé/abus/coûts incontrôlés.

**Tâches**:
- Créer backend Node.js ou Serverless Functions (`/api/categorize`, `/api/generate-script`).
- Déplacer `geminiService.ts` côté serveur avec validation d'input (sanitize, limites).
- Implémenter rate limiting (ex: 10 req/min/IP), authentification (token session ou API key interne).
- Mettre à jour frontend pour appeler `fetch('/api/...')` au lieu d'importer `@google/genai`.
- Supprimer définitions `process.env` de `vite.config.ts`.

**Livrables**: Backend fonctionnel, endpoints testés, frontend migré, clé sécurisée.

**Estimation**: 2–3 jours

---

### 2. Configuration : Normaliser environnement & build 🛠️

**Problème**: Incohérence `GEMINI_API_KEY` (README) vs `API_KEY` (code), pas de `.env.example`, Tailwind CDN (non optimal pour prod).

**Tâches**:
- Standardiser variable: `GEMINI_API_KEY` côté serveur uniquement.
- Créer `.env.example` avec documentation inline.
- Migrer Tailwind CDN → PostCSS + config fichier (performance build, purge CSS).
- Ajouter `index.css` manquant avec base styles et animations custom.
- Créer script `npm run check-env` qui valide les variables au démarrage.

**Livrables**: `.env.example`, `tailwind.config.js`, `postcss.config.js`, CSS optimisé, validation env.

**Estimation**: 1 jour

---

## 🟠 Priorité HAUTE (Fiabilité & Performance)

### 3. Robustesse RSS : Concurrence, retries, déduplication 🛡️

**Problème**: Fetch séquentiel bloque l'UI, pas de timeout/retry, doublons possibles, parsing fragile.

**Tâches**:
- Implémenter Promise.allSettled avec concurrency pool (pLimit, 4-6 workers).
- Ajouter timeouts (10s), retries exponentiels (3 tentatives), rotation automatique des proxies.
- Dédupliquer articles par hash(`link` + `title`) avant traitement IA.
- Gérer encodages exotiques et XML malformés (fallback gracieux).
- Ajouter localStorage cache court terme (1h TTL) pour éviter re-fetch.

**Livrables**: `rssService` résilient, tests unitaires (parsing, dedupe), amélioration UX temps de chargement.

**Estimation**: 1–2 jours

---

### 4. Persistence : LocalStorage & sauvegarde de configuration 💾

**Problème**: Feed list et sélections perdues au refresh, pas d'historique des runs.

**Tâches**:
- Sauvegarder `feeds[]` dans localStorage avec sync automatique.
- Persister dernière sélection date, articles récents, état de l'app.
- Ajouter bouton "Réinitialiser aux feeds par défaut".
- Option: implémenter export/import JSON de configuration.

**Livrables**: État persisté, UX améliorée (pas de perte de config), export/import optionnel.

**Estimation**: 0.5–1 jour

---

### 5. Batching & Cache AI (optimisation coûts) 💸

**Problème**: Un appel Gemini par batch entier peut timeout ou être coûteux ; pas de cache.

**Tâches**:
- Batcher requêtes en lots de 15–20 articles max, traiter en parallèle contrôlé.
- Implémenter cache LRU côté serveur (ou Redis) pour résultats classification (TTL 24h).
- Tracer métriques d'utilisation (nb tokens, latence, coût estimé).
- Implémenter fallback si Gemini fail: catégorie "Autre" avec warning utilisateur.

**Livrables**: Batching serveur, cache efficace, dashboard métriques basique, coûts réduits.

**Estimation**: 1–2 jours

---

## 🟡 Priorité MOYENNE (UX, Tests, Observabilité)

### 6. Tests unitaires & intégration + CI/CD 🚦

**Problème**: Aucun test = risque de régression, pas de validation automatique.

**Tâches**:
- Installer Jest + React Testing Library + Vitest (compatible Vite).
- Tests unitaires: `rssService` (parsing, dedupe), `geminiService` (mock API), composants (ArticleCard, FeedManager).
- Tests d'intégration endpoints (supertest ou playwright API).
- GitHub Actions: lint (ESLint), tests, build, deploy preview (Vercel/Netlify).

**Livrables**: Suite de tests (>60% coverage cible), pipeline CI automatique, badge status README.

**Estimation**: 2–3 jours

---

### 7. Gestion erreurs & toasts/notifications 🧭

**Problème**: Messages d'erreur inconsistants, pas de retry UI, alertes intrusives.

**Tâches**:
- Implémenter système de notifications (toast library: react-hot-toast ou sonner).
- Centraliser gestion erreurs (custom hook `useErrorHandler`).
- Ajouter boutons "Réessayer" sur erreurs temporaires (réseau, AI timeout).
- Logger erreurs côté serveur (Winston ou Pino) + monitoring optionnel (Sentry).

**Livrables**: UX d'erreur cohérente, toasts élégants, logs structurés serveur.

**Estimation**: 1 jour

---

### 8. Performance & Accessibilité (a11y) ♿

**Problème**: Pas de lazy loading, animations peuvent causer motion sickness, accessibilité limitée.

**Tâches**:
- Lazy load composants (React.lazy) et images (IntersectionObserver).
- Ajouter `prefers-reduced-motion` pour désactiver animations.
- Audit a11y: labels ARIA, navigation clavier, contraste couleurs (WCAG AA).
- Optimiser bundle: code splitting, tree shaking, analyse Lighthouse.

**Livrables**: Lighthouse score >90, navigation clavier complète, motion respecté.

**Estimation**: 1–2 jours

---

## 🟢 Priorité BASSE (Features additionnelles)

### 9. Recherche & filtres avancés 🔍

**Tâches**:
- Barre de recherche full-text (titre + description).
- Filtres multiples: source, date range custom, mots-clés.
- Tri: pertinence, date, source.

**Estimation**: 1 jour

---

### 10. Export multi-formats (PDF, Markdown, JSON) 📄

**Tâches**:
- Export script podcast en PDF (jsPDF) ou Markdown avec métadonnées.
- Export sélection articles en JSON/CSV.

**Estimation**: 1 jour

---

### 11. Historique & Analytics 📊

**Tâches**:
- Sauvegarder historique runs (DB: SQLite/Postgres ou Supabase).
- Dashboard analytics: articles traités, catégories populaires, sources actives.
- Graphiques tendances (Chart.js ou Recharts).

**Estimation**: 2–3 jours

---

### 12. Internationalisation (i18n) 🌍

**Tâches**:
- Intégrer react-i18next.
- Traductions FR/EN pour UI et catégories.
- Détection locale automatique.

**Estimation**: 1 jour

---

### 13. Mode sombre/clair & thèmes 🎨

**Tâches**:
- Implémenter toggle theme (déjà dark, ajouter light).
- Sauvegarder préférence utilisateur.
- Thèmes custom optionnels.

**Estimation**: 0.5 jour

---

### 14. PWA & mode offline 📱

**Tâches**:
- Ajouter manifest.json, service worker (Vite PWA plugin).
- Cache articles offline, sync en background.

**Estimation**: 1–2 jours

---

### 15. Scheduler automatique & webhooks 🤖

**Tâches**:
- Cron job serveur pour scrapes quotidiens.
- Webhooks notification (Slack, Discord, email) quand nouveaux articles.

**Estimation**: 1–2 jours

---

## 📋 Plan de Sprint recommandé (3 semaines)

### Sprint 1 (Semaine 1 — Sécurité & Stabilité)
- **Jour 1-3**: Point 1 (Backend Gemini API + migration frontend)
- **Jour 4**: Point 2 (Env vars + Tailwind setup)
- **Jour 5**: Point 4 (Persistence localStorage)

### Sprint 2 (Semaine 2 — Performance & Résilience)
- **Jour 6-7**: Point 3 (Robustesse RSS)
- **Jour 8-9**: Point 5 (Batching & Cache AI)
- **Jour 10**: Point 7 (Toasts & erreurs)

### Sprint 3 (Semaine 3 — Tests & Qualité)
- **Jour 11-13**: Point 6 (Tests + CI/CD)
- **Jour 14-15**: Point 8 (Performance & a11y)
- **Jour 16+**: Features optionnelles selon priorité métier

---

## 🎯 Métriques de succès

- ✅ Clé API sécurisée (jamais exposée client)
- ✅ Coverage tests >60%
- ✅ Lighthouse score >90
- ✅ Temps chargement articles <3s (20 feeds)
- ✅ 0 erreurs critiques en production
- ✅ Coûts IA réduits de 40% (cache + batching)

---

## 💡 Bonnes pratiques & guidelines

### Sécurité
- Jamais de secrets côté client (env, tokens, clés).
- Implémenter rate limiting et CORS strict.
- Valider/sanitize tous les inputs utilisateur.
- Audit dépendances régulier (`npm audit`).

### Performance
- Bundle analysis régulier (vite-bundle-visualizer).
- Lazy load routes et composants lourds.
- Utiliser React.memo pour composants coûteux.
- Optimiser images (WebP, srcset).

### Observabilité
- Logs structurés JSON (serveur).
- Monitoring erreurs (Sentry ou similaire).
- Métriques business (nb articles, temps traitement).
- Alertes automatiques (downtime, quota dépassé).

### Code Quality
- ESLint + Prettier configurés.
- Pre-commit hooks (Husky + lint-staged).
- Conventional Commits pour changelog auto.
- Documentation inline (JSDoc pour fonctions complexes).

---

## 📚 Stack technique recommandée

### Frontend actuel
- React 19.2
- Vite 6.2
- TypeScript 5.8
- Tailwind CSS (à migrer CDN → config)

### Backend recommandé
- Node.js 20+ / Bun
- Express ou Fastify (ou Serverless Functions)
- Rate limiting: express-rate-limit
- Validation: Zod ou Yup

### Infrastructure
- Vercel / Netlify (frontend + serverless)
- Redis/Upstash (cache AI)
- Supabase/PlanetScale (DB optionnelle)
- GitHub Actions (CI/CD)

### Monitoring & Observabilité
- Sentry (erreurs runtime)
- Vercel Analytics (performance)
- LogTail ou Logtail (logs serveur)

---

## 🚀 Quick Wins (gains rapides)

1. **Ajouter `.env.example`** → 10 min
2. **Persister feeds dans localStorage** → 30 min
3. **Améliorer messages d'erreur** → 1h
4. **Ajouter loading skeletons** → 1h
5. **Implémenter déduplication articles** → 2h

---

_Document généré après analyse complète du projet — Prêt pour implémentation immédiate._
