# Déploiement Coolify (Dockerfile) — TechPulse AI

Ce guide configure l’application pour un déploiement direct dans Coolify avec un conteneur unique:
- Frontend React servi par Express
- API backend
- Schedulers (pipeline horaire + pipeline podcast du samedi)

## 1) Prérequis
- Instance Coolify opérationnelle
- Repo Git accessible depuis Coolify
- Clés API IA et credentials SMTP prêts
- Domaine (optionnel)

## 2) Créer l’application dans Coolify
1. Ouvrir Coolify → **New Resource** → **Application**
2. Choisir votre provider Git (GitHub/GitLab/etc.)
3. Sélectionner ce repository
4. **Build Pack**: choisir **Dockerfile**
5. **Dockerfile Location**: `./Dockerfile`
6. **Port Exposed**: `5555`

## 3) Variables d’environnement à configurer
Copier les variables depuis [.env.coolify.example](.env.coolify.example), puis adapter les secrets.

### Variables minimales recommandées
- `NODE_ENV=production`
- `PORT=5555`
- `AI_PROVIDER=mistral`
- `MISTRAL_API_KEY=...`
- `EMAIL_HOST=...`
- `EMAIL_PORT=587`
- `EMAIL_SECURE=false`
- `EMAIL_USER=...`
- `EMAIL_PASS=...`
- `EMAIL_FROM=TechPulse AI <...>`

### Pipeline horaire (automatique)
- `AUTO_PIPELINE_ENABLED=true`
- `AUTO_PIPELINE_CRON=0 * * * *`
- `AUTO_PIPELINE_FEEDS=["https://...","https://..."]`
- `AUTO_SELECT_MAX_PER_CATEGORY=5`
- `AUTO_PIPELINE_LOOKBACK_HOURS=24`

### Pipeline podcast samedi 10h
- `SATURDAY_PODCAST_ENABLED=true`
- `SATURDAY_PODCAST_CRON=0 10 * * 6`
- `SATURDAY_PODCAST_TIMEZONE=Europe/Paris`
- `SATURDAY_PODCAST_EMAIL_TO=votre@email.com`
- `SATURDAY_PODCAST_MAX_PER_CATEGORY=2`
- `INTERNAL_API_BASE_URL=http://127.0.0.1:5555`

## 4) Persistance des données (important)
L’application stocke le flux interne et archives dans `/app/data`.

Dans Coolify, ajouter un volume persistant:
- **Container Path**: `/app/data`
- **Host/Managed Volume**: selon votre stratégie Coolify

Sans volume, les données RSS internes seront perdues à chaque redeploy.

## 5) Domaine, HTTPS et healthcheck
- Mapper votre domaine dans Coolify (proxy/SSL géré par Coolify)
- Vérifier la santé:
  - `GET /api/health`
  - Exemple: `https://votre-domaine/api/health`

## 6) Déployer
1. Cliquer **Deploy**
2. Vérifier les logs de build
3. Vérifier les logs runtime
4. Vérifier:
   - UI: `https://votre-domaine/`
   - API health: `https://votre-domaine/api/health`

## 7) Vérifier les pipelines
### Pipeline horaire
- Endpoint état: `GET /api/scheduler/status`
- Champs à contrôler: `autoPipeline.enabled`, `nextAutoPipelineRun`

### Pipeline podcast samedi
- Endpoint état: `GET /api/scheduler/status`
- Champs: `saturdayPodcast.enabled`, `nextSaturdayPodcastRun`
- Déclenchement manuel de test:
  - `POST /api/scheduler/podcast-saturday`

### Pipeline blog-feed manuel (si besoin)
- `POST /api/scheduler/blog-feed`

## 8) Dépannage rapide
- **Pas d’email reçu**: vérifier `EMAIL_*` + spam + logs SMTP
- **Pas de contenu podcast samedi**:
  - vérifier que `/api/feeds/all.xml` contient des articles
  - vérifier `INTERNAL_API_BASE_URL`
  - vérifier `MISTRAL_API_KEY`
- **Pas de données persistées**: vérifier volume `/app/data`
- **Cron non exécuté**: vérifier timezone et expressions CRON

## 9) CRON recommandés
- Horaire: `0 * * * *`
- Podcast samedi: `0 10 * * 6`

## 10) Sécurité
- Ne jamais committer les secrets
- Limiter les accès SMTP
- Utiliser des mots de passe d’application SMTP
- Garder `RATE_LIMIT_MAX_REQUESTS` actif
