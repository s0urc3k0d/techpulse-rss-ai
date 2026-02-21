# Déploiement Coolify avec Docker Compose — TechPulse AI

Ce guide déploie TechPulse via `docker-compose.coolify.yml` dans Coolify, avec:
- domaine custom
- HTTPS via proxy (Traefik)
- durcissement conteneur
- persistance `/app/data`
- pipelines auto (horaire + podcast samedi)

## 1) Fichiers utilisés
- Compose: [docker-compose.coolify.yml](docker-compose.coolify.yml)
- Variables: [.env.coolify.compose.example](.env.coolify.compose.example)
- Image: [Dockerfile](Dockerfile)

## 2) Préparer les variables
1. Copier `.env.coolify.compose.example`
2. Renseigner vos valeurs réelles

Variables critiques:
- `APP_DOMAIN` (ex: `techpulse.votredomaine.com`)
- `MISTRAL_API_KEY`
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`
- `SATURDAY_PODCAST_EMAIL_TO`
- `SCHEDULER_STARTUP_WARMUP_SECONDS` (recommandé: `45` en prod si run-on-start activé)

## 3) Créer une app Compose dans Coolify
1. Coolify → **New Resource** → **Application**
2. Choisir votre repository Git
3. Choisir le mode **Docker Compose**
4. Fichier compose: `docker-compose.coolify.yml`
5. Coller/charger les variables de `.env.coolify.compose.example` dans l’onglet env Coolify

## 4) Domaine et réseau proxy
Le compose inclut des labels Traefik avec `APP_DOMAIN`.

Points importants:
- `APP_DOMAIN` doit être défini
- `PROXY_NETWORK` doit correspondre au réseau proxy Coolify (souvent `coolify`)
- Le DNS du domaine doit pointer vers votre serveur Coolify

⚠️ Si `APP_DOMAIN` est incorrect ou vide, vous aurez typiquement un certificat Traefik invalide ou "no available server" côté route.

## 5) Sécurité intégrée
Le service est durci par défaut:
- `read_only: true`
- `tmpfs /tmp`
- `cap_drop: [ALL]`
- `no-new-privileges`
- `user` non-root (via Dockerfile)
- healthcheck `/api/health`

## 6) Persistance des données
Le volume `techpulse-data` est monté sur `/app/data`.
Ce volume conserve:
- flux RSS interne
- index
- archives

## 7) Déploiement
1. Cliquer **Deploy**
2. Vérifier que le conteneur est `healthy`
3. Vérifier:
   - `https://APP_DOMAIN/`
   - `https://APP_DOMAIN/api/health`
   - `https://APP_DOMAIN/api/scheduler/status`

## 7.1) Gateway timeout au démarrage
Si vous activez `*_RUN_ON_START=true` sur plusieurs pipelines, le démarrage peut être lourd (fetch RSS + IA + email), ce qui peut provoquer des timeouts côté gateway/proxy.

Actions recommandées:
- Garder `AUTO_PIPELINE_RUN_ON_START=false` et `SATURDAY_PODCAST_RUN_ON_START=false` en prod (préféré)
- Ou définir `SCHEDULER_STARTUP_WARMUP_SECONDS=45` (ou `60`) pour retarder les jobs de boot
- Vérifier que `/api/health` répond rapidement juste après le démarrage du conteneur

## 8) Vérifier les pipelines
- Horaire: `AUTO_PIPELINE_ENABLED=true`, `AUTO_PIPELINE_CRON=0 * * * *`
- Podcast samedi: `SATURDAY_PODCAST_ENABLED=true`, `SATURDAY_PODCAST_CRON=0 10 * * 6`

Réglages anti-rate-limit Mistral (recommandés):
- `SATURDAY_PODCAST_ENRICH_DELAY_MS=1200`
- `SATURDAY_PODCAST_ENRICH_BATCH_SIZE=4`
- `SATURDAY_PODCAST_ENRICH_MAX_RETRIES=2`
- `SATURDAY_PODCAST_ENRICH_RETRY_DELAY_MS=3000`

Déclenchement manuel test:
- `POST /api/scheduler/blog-feed`
- `POST /api/scheduler/podcast-saturday`

## 8.1) Permissions volume (important)
Le compose démarre un service `techpulse-init` qui prépare les droits du volume `techpulse-data` pour l'utilisateur non-root du conteneur principal.

Si vous voyez `EACCES: permission denied, mkdir '/app/data/current'`:
- Vérifiez que `techpulse-init` s'exécute bien avant `techpulse`
- Supprimez/recréez le volume `techpulse-data` si nécessaire
- Redéployez ensuite l'application

## 9) Notes Coolify
- Si votre instance Coolify gère déjà le routage via UI, gardez les labels compose cohérents avec votre setup.
- Si nécessaire, adaptez `PROXY_NETWORK`.
- En cas de conflit de routage, retirez les labels Traefik et configurez le domaine dans l’UI Coolify uniquement.

## 9.1) SMTP 535 Authentication failed
Si vous voyez `Invalid login: 535 5.7.1 Authentication failed`:
- Vérifiez `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`
- Vérifiez `EMAIL_USER` et `EMAIL_PASS`
- Gmail/Google Workspace: utilisez un mot de passe d’application (pas le mot de passe principal)
- Office365/Outlook: utiliser SMTP Auth activé côté tenant/boîte
- Testez les credentials SMTP hors app avant redéploiement

## 9.2) Mistral 429 Rate limit exceeded
Si vous voyez `429 Too Many Requests` / `x-ratelimit-remaining-tokens-minute: 0`:
- N'utilisez pas des batches massifs (100 est trop élevé en pratique pour ce prompt)
- Augmentez `SATURDAY_PODCAST_ENRICH_DELAY_MS` (ex: `1500` à `2500`)
- Gardez `SATURDAY_PODCAST_ENRICH_BATCH_SIZE` entre `3` et `8`
- Gardez `SATURDAY_PODCAST_ENRICH_MAX_RETRIES=2` (ou `3` max)
- Réduisez `SATURDAY_PODCAST_MAX_PER_CATEGORY` (ex: `1`) pour un run manuel de rattrapage

Le pipeline envoie désormais un email même si l'enrichissement IA échoue, via un fallback basé sur les métadonnées article.

## 10) Checklist finale
- [ ] DNS OK
- [ ] `APP_DOMAIN` exactement égal au domaine configuré dans Coolify
- [ ] Variables secrètes remplies
- [ ] Volume persistant actif
- [ ] Healthcheck vert
- [ ] Status scheduler valide
- [ ] Email de test reçu
