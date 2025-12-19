# 📧 Configuration Email & Scheduler

## Configuration Email (SMTP)

Pour utiliser le scheduler avec envoi d'emails, configurez les variables d'environnement suivantes dans votre fichier `.env` :

### Gmail (Recommandé)

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=votre_email@gmail.com
EMAIL_PASS=votre_mot_de_passe_application
EMAIL_FROM="TechPulse AI <votre_email@gmail.com>"
```

**⚠️ Important pour Gmail** : Vous devez créer un "Mot de passe d'application" :
1. Allez sur https://myaccount.google.com/security
2. Activez la validation en 2 étapes
3. Générez un mot de passe d'application pour "Mail"
4. Utilisez ce mot de passe dans `EMAIL_PASS`

### Autres fournisseurs

#### Outlook/Hotmail
```bash
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=votre_email@outlook.com
EMAIL_PASS=votre_mot_de_passe
```

#### SendGrid (Professionnel)
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=votre_clé_api_sendgrid
```

#### Mailgun
```bash
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=postmaster@votre-domaine.mailgun.org
EMAIL_PASS=votre_mot_de_passe_mailgun
```

---

## Configuration Scheduler

### Variables d'environnement

```bash
# Activer/désactiver le scheduler
SCHEDULER_ENABLED=true

# Expression CRON (quand exécuter le job)
SCHEDULER_CRON=0 9 * * *

# Fuseau horaire
SCHEDULER_TIMEZONE=Europe/Paris

# Adresse email de destination
SCHEDULER_EMAIL_TO=votre_email@example.com

# Exécuter au démarrage (pour tests)
SCHEDULER_RUN_ON_START=false

# Flux RSS à scraper (JSON array)
SCHEDULER_FEEDS=["https://news.ycombinator.com/rss","https://techcrunch.com/feed/"]
```

### Expressions CRON

Format : `seconde minute heure jour_du_mois mois jour_de_la_semaine`

Exemples courants :
- `0 9 * * *` - Tous les jours à 9h00
- `0 9 * * 1-5` - Tous les jours ouvrés à 9h00
- `0 */6 * * *` - Toutes les 6 heures
- `0 9,18 * * *` - À 9h et 18h tous les jours
- `0 9 * * 1` - Tous les lundis à 9h00

### Exemple de configuration complète

```bash
# .env
GEMINI_API_KEY=votre_clé_gemini

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=techpulse@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
EMAIL_FROM="TechPulse AI <techpulse@gmail.com>"

# Scheduler
SCHEDULER_ENABLED=true
SCHEDULER_CRON=0 9 * * *
SCHEDULER_TIMEZONE=Europe/Paris
SCHEDULER_EMAIL_TO=equipe@entreprise.com
SCHEDULER_RUN_ON_START=false
SCHEDULER_FEEDS=["https://news.ycombinator.com/rss","https://techcrunch.com/feed/","https://www.theverge.com/rss/index.xml"]
```

---

## API Endpoints

### GET /api/scheduler/status

Vérifier l'état du scheduler :

```bash
curl http://localhost:3001/api/scheduler/status
```

Réponse :
```json
{
  "status": "ok",
  "scheduler": {
    "enabled": true,
    "cronExpression": "0 9 * * *",
    "timezone": "Europe/Paris",
    "emailConfigured": true,
    "runOnStart": false
  },
  "nextRun": "2025-12-20T09:00:00.000Z"
}
```

### POST /api/scheduler/trigger

Déclencher manuellement un scraping et envoi d'email :

```bash
curl -X POST http://localhost:3001/api/scheduler/trigger \
  -H "Content-Type: application/json" \
  -d '{"email":"votre_email@example.com"}'
```

Réponse :
```json
{
  "message": "Manual scraping triggered successfully",
  "email": "votre_email@example.com",
  "note": "You will receive an email when the process is complete"
}
```

---

## Fonctionnement du Scheduler

### Workflow automatique

1. **Déclenchement** : Le scheduler s'exécute selon le CRON configuré (par défaut : 9h chaque matin)
2. **Fetch RSS** : Récupération de tous les flux RSS configurés
3. **Filtrage** : Ne garde que les articles des dernières 24h
4. **Catégorisation IA** : Classification automatique avec Gemini
5. **Génération email** : Création d'un email HTML stylisé avec :
   - Statistiques (total articles, catégories, sources)
   - Articles groupés par catégorie
   - Top 5 articles par catégorie
   - Liens directs vers les articles
6. **Envoi** : Email envoyé à l'adresse configurée

### Template Email

L'email envoyé contient :
- 📊 **Résumé** : Nombre d'articles, catégories, sources
- 📰 **Articles par catégorie** : Jusqu'à 5 articles par catégorie
- 🎨 **Design** : Template HTML responsive et stylisé
- 📱 **Compatible mobile** : Optimisé pour tous les écrans

### Logs

Le scheduler génère des logs détaillés :

```
⏰ [Scheduler] Activé avec cron: 0 9 * * *
📧 [Scheduler] Email destination: user@example.com
📡 [Scheduler] 3 flux RSS configurés
✅ [Scheduler] Initialisé avec succès

🚀 [Scheduler] Démarrage du scraping quotidien...
📡 [Scheduler] Récupération de 3 flux RSS...
✅ [Scheduler] 25 articles depuis https://news.ycombinator.com/rss
📅 [Scheduler] 18 articles des dernières 24h
🤖 [Scheduler] Catégorisation IA en cours...
✅ [Scheduler] 18 articles catégorisés
✅ [Scheduler] Email envoyé avec succès!
```

---

## Tests

### Test rapide (sans attendre le CRON)

Activez l'exécution au démarrage :

```bash
SCHEDULER_RUN_ON_START=true npm run dev:server
```

Le scraping s'exécutera 5 secondes après le démarrage du serveur.

### Test manuel via API

```bash
# Déclencher manuellement
curl -X POST http://localhost:3001/api/scheduler/trigger \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Vérifier la configuration

```bash
curl http://localhost:3001/api/scheduler/status
```

---

## Dépannage

### Problème : Email non envoyé

**Solutions** :
1. Vérifiez les variables EMAIL_* dans `.env`
2. Pour Gmail, utilisez un mot de passe d'application
3. Vérifiez les logs du serveur pour les erreurs SMTP
4. Testez la connexion SMTP avec un outil comme `telnet`

### Problème : Scheduler ne démarre pas

**Solutions** :
1. Vérifiez `SCHEDULER_ENABLED=true`
2. Vérifiez l'expression CRON (format valide)
3. Consultez les logs au démarrage du serveur

### Problème : Pas d'articles récupérés

**Solutions** :
1. Vérifiez que les URLs RSS sont valides
2. Testez manuellement avec `curl https://url-du-flux`
3. Augmentez la fenêtre de temps (dernières 48h au lieu de 24h)

---

## Sécurité

⚠️ **Important** :
- Ne commitez JAMAIS le fichier `.env` (déjà dans `.gitignore`)
- Utilisez des mots de passe d'application pour Gmail
- Limitez les permissions du compte email (envoi uniquement)
- Surveillez les quotas API Gemini

---

## Production

Pour le déploiement en production :

1. **Variables d'environnement** : Configurez via votre plateforme (Heroku, Vercel, etc.)
2. **Service email professionnel** : SendGrid, Mailgun, ou AWS SES
3. **Monitoring** : Ajoutez des alertes si l'email n'est pas envoyé
4. **Rate limiting** : Respectez les limites API Gemini

### Exemple Heroku

```bash
heroku config:set SCHEDULER_ENABLED=true
heroku config:set SCHEDULER_CRON="0 9 * * *"
heroku config:set EMAIL_HOST=smtp.sendgrid.net
heroku config:set EMAIL_USER=apikey
heroku config:set EMAIL_PASS=SG.xxxxx
heroku config:set SCHEDULER_EMAIL_TO=team@company.com
```

---

**Documentation complète** : Voir `ROADMAP.md` pour plus de détails
