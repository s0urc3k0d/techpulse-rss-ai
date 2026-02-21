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

## 8) Vérifier les pipelines
- Horaire: `AUTO_PIPELINE_ENABLED=true`, `AUTO_PIPELINE_CRON=0 * * * *`
- Podcast samedi: `SATURDAY_PODCAST_ENABLED=true`, `SATURDAY_PODCAST_CRON=0 10 * * 6`

Déclenchement manuel test:
- `POST /api/scheduler/blog-feed`
- `POST /api/scheduler/podcast-saturday`

## 9) Notes Coolify
- Si votre instance Coolify gère déjà le routage via UI, gardez les labels compose cohérents avec votre setup.
- Si nécessaire, adaptez `PROXY_NETWORK`.
- En cas de conflit de routage, retirez les labels Traefik et configurez le domaine dans l’UI Coolify uniquement.

## 10) Checklist finale
- [ ] DNS OK
- [ ] Variables secrètes remplies
- [ ] Volume persistant actif
- [ ] Healthcheck vert
- [ ] Status scheduler valide
- [ ] Email de test reçu
