# 🚀 Performance & Accessibilité

## Optimisations mises en place

### 1. **Performance Bundle**
- ✅ **Code Splitting** : React/React-DOM dans chunk séparé
- ✅ **Bundle Analyzer** : `rollup-plugin-visualizer` (voir `dist/stats.html` après build)
- ✅ **Sourcemaps désactivés** en production (réduction taille)
- ✅ **Lazy Loading prêt** : architecture modulaire pour React.lazy()

### 2. **Accessibilité (A11y)**
- ✅ **Skip Navigation** : Lien "Aller au contenu principal" pour lecteurs d'écran
- ✅ **ARIA Labels** : Tous les boutons/inputs ont des labels descriptifs
  - Checkbox articles : `aria-label="Sélectionner {titre}"`
  - Boutons : `aria-label` explicites
  - Inputs : Labels visuels + `id`/`for` associations
- ✅ **Focus Visible** : Outline bleu 2px sur `:focus-visible`
- ✅ **Sémantique HTML** : `<article>`, `<main>`, `<header>`, `<nav>`
- ✅ **Contraste** : Couleurs respectant WCAG AA (ratios vérifiés)
- ✅ **aria-hidden** : SVG décoratifs marqués `aria-hidden="true"`
- ✅ **aria-busy** : États de chargement indiqués pour assistants

### 3. **Motion & Animations**
- ✅ **prefers-reduced-motion** : CSS media query implémentée
  ```css
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; }
  }
  ```
- ✅ **Animations légères** : fadeIn (0.3s), bounceIn (0.5s)
- ✅ **Respect préférences utilisateur** : Désactivation automatique si préférence système

### 4. **SEO & Meta**
- ✅ **lang="fr"** : Attribut langue sur `<html>`
- ✅ **meta description** : Description SEO complète
- ✅ **theme-color** : Couleur thème app (#0f172a)
- ✅ **viewport** : Meta viewport responsive

### 5. **UX Keyboard Navigation**
- ✅ **Tab Order** : Navigation clavier logique
- ✅ **Focus Trap** : Pas de piège de focus
- ✅ **Escape Key** : Fermeture modale/dropdown (si applicable)
- ✅ **Enter/Space** : Activation boutons/checkbox

## Métriques de Performance

### Bundle Analysis (après build)
```bash
npm run build
# Voir dist/stats.html pour :
# - Taille des chunks
# - Dépendances lourdes
# - Opportunities de lazy loading
```

### Audit Lighthouse recommandé
```bash
# Performance : >= 90
# Accessibility : >= 90
# Best Practices : >= 90
# SEO : >= 90
```

## Lazy Loading (Prêt à activer)

Pour activer le lazy loading sur ArticleCard :

```tsx
// App.tsx
import { lazy, Suspense } from 'react';
const ArticleCard = lazy(() => import('./components/ArticleCard'));

// Dans le render :
<Suspense fallback={<div className="animate-pulse bg-slate-700 h-64 rounded" />}>
  <ArticleCard article={article} />
</Suspense>
```

## Checklist Accessibilité ✅

- [x] Skip navigation link
- [x] Semantic HTML (header, main, article)
- [x] ARIA labels sur tous les interactifs
- [x] Focus visible (outline bleu)
- [x] Contraste couleurs >= 4.5:1
- [x] Keyboard navigation complète
- [x] prefers-reduced-motion
- [x] aria-hidden sur SVG décoratifs
- [x] aria-busy sur états de chargement
- [x] Attribut lang="fr"
- [x] Meta description & viewport

## Améliorations Futures (Optionnel)

### Lazy Loading Images
```tsx
<img loading="lazy" src={url} alt={desc} />
```

### Service Worker (PWA)
- Cache API responses
- Offline support
- Background sync

### Virtual Scrolling
- Pour > 100 articles
- Lib: `react-window` ou `react-virtualized`

### WebP Images
- Optimisation formats modernes
- Fallback PNG/JPG

---

**Status** : ✅ Toutes les optimisations critiques sont implémentées
