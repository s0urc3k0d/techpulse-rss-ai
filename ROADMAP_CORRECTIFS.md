# Roadmap Correctifs — Février 2026

Ce document suit les correctifs techniques prioritaires identifiés lors de l’audit du projet.

## Objectif
Stabiliser le socle (types, exports, cohérence runtime/doc, petites incohérences UI) avant les optimisations plus lourdes.

## Priorité P1 (immédiat)

### 1) Aligner les types de script podcast et les exports
- Statut: **Terminé**
- Problème: `services/exportService.ts` exporte un format podcast qui ne correspond pas à `PodcastScriptItem` dans `types.ts`.
- Action: Adapter l’export markdown podcast au contrat de type actuel (`originalId`, `catchyTitle`, `keyPoints`).
- Bénéfice: cohérence TypeScript, réduction des erreurs runtime et confusion de maintenance.

### 2) Corriger incohérences UI mineures
- Statut: **Terminé**
- Problème: bouton de réinitialisation des feeds affiché en doublon dans `FeedManager`.
- Action: supprimer la duplication pour garder une action unique.
- Bénéfice: UX plus claire.

### 3) Harmoniser la documentation du port backend
- Statut: **Terminé**
- Problème: docs indiquent parfois `3001` alors que le backend tourne par défaut sur `5555`.
- Action: mettre à jour la doc principale sur le port backend.
- Bénéfice: onboarding/dev plus fiable.

## Priorité P2 (prochain lot)

### 4) Nettoyage code legacy Gemini
- Statut: **Terminé**
- Action: retirer/archiver `services/geminiService.ts` si plus utilisé et nettoyer docs associées.

### 5) Unification catégories Scheduler/UI
- Statut: **Terminé**
- Action: harmoniser les taxonomies de catégories entre flux principal et scheduler.

### 6) Renforcer tests d’intégration API
- Statut: **Terminé (lot baseline)**
- Action: ajouter tests routes critiques (`rss`, `categorize`, `generate-script`, `feeds`).

## Journal d’exécution
- 2026-02-17: Création du plan et lancement du lot P1.
- 2026-02-17: Alignement export podcast avec les types actuels (`catchyTitle`, `keyPoints`).
- 2026-02-17: Correction UI FeedManager (suppression duplication bouton reset).
- 2026-02-17: Harmonisation doc sur le port backend `5555`.
- 2026-02-17: Suppression du legacy `services/geminiService.ts` et nettoyage doc migration/README.
- 2026-02-17: Unification des catégories scheduler sur la taxonomie officielle + normalisation robuste des retours IA.
- 2026-02-17: Ajout des tests d’intégration API de base (health + validations `categorize`, `generate-script`, `rss/fetch`).
- 2026-02-17: Stabilisation de la suite de tests globale (correctif `errorService.ts` sans JSX + mock `localStorage` fonctionnel dans `tests/setup.ts`).
- 2026-02-17: Implémentation de la pipeline automatique horaire (RSS -> catégorisation -> top N/catégorie -> sauvegarde automatique feed RSS).
- 2026-02-17: Ajout d'une pipeline hebdomadaire podcast (samedi 10h): lecture RSS XML interne, sélection top 2/catégorie, enrichissement Mistral, envoi email.
