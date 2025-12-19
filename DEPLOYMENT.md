# 🚀 Guide de Déploiement TechPulse sur VPS

Ce guide détaille le déploiement complet de TechPulse sur un VPS Ubuntu/Debian avec Nginx, PM2 et SSL (Certbot).

## 📋 Prérequis

- VPS Ubuntu 20.04+ ou Debian 11+
- Accès root/sudo
- Domaine configuré : `techpulse.sourcekod.fr` et `www.techpulse.sourcekod.fr`
- DNS pointant vers l'IP du VPS (A records)

## 🛠️ Installation initiale du serveur

### 1. Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Installation de Node.js 20.x

```bash
# Installation de NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Installation de Node.js
sudo apt install -y nodejs

# Vérification
node -v  # v20.x.x
npm -v   # 10.x.x
```

### 3. Installation de PM2

```bash
sudo npm install -g pm2

# Configuration du démarrage automatique
sudo pm2 startup systemd -u $USER --hp $HOME
```

### 4. Installation de Nginx

```bash
sudo apt install -y nginx

# Démarrage et activation
sudo systemctl start nginx
sudo systemctl enable nginx

# Vérification
sudo systemctl status nginx
```

### 5. Installation de Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

## 📂 Préparation de l'application

### 1. Création du répertoire

```bash
sudo mkdir -p /var/www/techpulse
sudo chown -R $USER:$USER /var/www/techpulse
```

### 2. Clone du repository

```bash
cd /var/www/techpulse
git clone https://github.com/votre-username/techpulse-rss-ai.git .
```

### 3. Installation des dépendances

```bash
npm ci --legacy-peer-deps
```

### 4. Configuration des variables d'environnement

```bash
cp .env.example .env
nano .env
```

**Variables obligatoires** :

```env
# Gemini AI
GEMINI_API_KEY=votre_cle_api_gemini

# Server
PORT=3000
NODE_ENV=production

# Scheduler (optionnel)
SCHEDULER_ENABLED=true
SCHEDULER_CRON="0 9 * * *"

# Email (si scheduler activé)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=votre-email@gmail.com
EMAIL_PASSWORD=votre-mot-de-passe-app
EMAIL_RECIPIENT=destinataire@example.com
```

### 5. Build de l'application

```bash
# Build frontend
npm run build

# Build backend
npm run build:server

# Création du dossier logs
mkdir -p logs
```

## 🔧 Configuration Nginx

### ÉTAPE 1 : Configuration HTTP (avant Certbot)

```bash
# Copie de la configuration HTTP
sudo cp nginx-http.conf /etc/nginx/sites-available/techpulse

# Création du lien symbolique
sudo ln -s /etc/nginx/sites-available/techpulse /etc/nginx/sites-enabled/

# Suppression de la config par défaut
sudo rm /etc/nginx/sites-enabled/default

# Test de la configuration
sudo nginx -t

# Redémarrage de Nginx
sudo systemctl reload nginx
```

### ÉTAPE 2 : Génération du certificat SSL avec Certbot

```bash
# Obtention du certificat SSL
sudo certbot --nginx -d techpulse.sourcekod.fr -d www.techpulse.sourcekod.fr

# Suivre les instructions interactives :
# - Entrer votre email
# - Accepter les conditions
# - Choisir si vous voulez recevoir les newsletters
# - Choisir "2" pour rediriger HTTP vers HTTPS
```

**Note** : Certbot modifiera automatiquement votre configuration Nginx. Mais pour plus de contrôle, vous pouvez utiliser la configuration HTTPS personnalisée.

### ÉTAPE 3 : Configuration HTTPS (après Certbot)

```bash
# Remplacement par la configuration HTTPS complète
sudo cp nginx-https.conf /etc/nginx/sites-available/techpulse

# Test de la configuration
sudo nginx -t

# Redémarrage de Nginx
sudo systemctl reload nginx
```

### Renouvellement automatique SSL

Certbot installe automatiquement un cron pour le renouvellement. Vérification :

```bash
# Test du renouvellement
sudo certbot renew --dry-run

# Vérification du timer systemd
sudo systemctl status certbot.timer
```

## 🚀 Déploiement avec PM2

### 1. Démarrage de l'application

```bash
cd /var/www/techpulse

# Démarrage avec PM2
pm2 start ecosystem.config.cjs

# Sauvegarde de la configuration
pm2 save
```

### 2. Vérification du statut

```bash
# Statut des processus
pm2 status

# Logs en temps réel
pm2 logs techpulse-api

# Logs des erreurs uniquement
pm2 logs techpulse-api --err

# Monitoring
pm2 monit
```

### 3. Commandes utiles PM2

```bash
# Redémarrer l'application
pm2 reload techpulse-api

# Arrêter l'application
pm2 stop techpulse-api

# Redémarrer complètement
pm2 restart techpulse-api

# Supprimer de PM2
pm2 delete techpulse-api

# Afficher les informations détaillées
pm2 show techpulse-api

# Vider les logs
pm2 flush
```

## 🔄 Script de déploiement automatisé

Pour les mises à jour futures, utilisez le script `deploy.sh` :

```bash
# Rendre le script exécutable
chmod +x deploy.sh

# Éditer l'URL du repository
nano deploy.sh
# Modifier REPO_URL avec votre repository GitHub

# Exécuter le déploiement
./deploy.sh
```

**Ce que fait le script** :
- Pull du code depuis Git
- Installation des dépendances
- Build frontend et backend
- Rechargement de PM2
- Affichage des logs

## 🔐 Sécurité supplémentaire

### 1. Configuration du firewall (UFW)

```bash
# Installation
sudo apt install -y ufw

# Configuration des ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# Activation
sudo ufw enable

# Vérification
sudo ufw status
```

### 2. Fail2ban (protection SSH)

```bash
# Installation
sudo apt install -y fail2ban

# Configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Démarrage
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 3. Désactiver l'accès root SSH

```bash
sudo nano /etc/ssh/sshd_config

# Modifier :
PermitRootLogin no
PasswordAuthentication no  # Si vous utilisez des clés SSH

# Redémarrer SSH
sudo systemctl restart sshd
```

## 📊 Monitoring et Logs

### Logs Nginx

```bash
# Logs d'accès
sudo tail -f /var/log/nginx/techpulse-access.log

# Logs d'erreur
sudo tail -f /var/log/nginx/techpulse-error.log
```

### Logs PM2

```bash
# Logs combinés
pm2 logs techpulse-api --lines 100

# Fichiers de logs
cat /var/www/techpulse/logs/pm2-error.log
cat /var/www/techpulse/logs/pm2-out.log
```

### Logs système

```bash
# Logs Nginx
sudo journalctl -u nginx -f

# Logs Certbot
sudo journalctl -u certbot.timer
```

## 🔧 Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs techpulse-api --err

# Vérifier le fichier .env
cat /var/www/techpulse/.env

# Vérifier le port 3000
sudo netstat -tlnp | grep 3000
```

### Erreur 502 Bad Gateway

```bash
# Vérifier que PM2 est en cours d'exécution
pm2 status

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/techpulse-error.log

# Redémarrer l'application
pm2 reload techpulse-api
```

### Certificat SSL non valide

```bash
# Vérifier les certificats
sudo certbot certificates

# Forcer le renouvellement
sudo certbot renew --force-renewal
```

### Problèmes de permissions

```bash
# Corriger les permissions
sudo chown -R $USER:$USER /var/www/techpulse
chmod -R 755 /var/www/techpulse
```

## 🔄 Mise à jour de l'application

### Méthode rapide avec le script

```bash
cd /var/www/techpulse
./deploy.sh
```

### Méthode manuelle

```bash
cd /var/www/techpulse

# Pull des dernières modifications
git pull origin main

# Installation des dépendances
npm ci --legacy-peer-deps

# Build
npm run build
npm run build:server

# Rechargement PM2
pm2 reload ecosystem.config.cjs --update-env
```

## 📱 Vérification du déploiement

1. **Frontend** : https://techpulse.sourcekod.fr
2. **API Health** : https://techpulse.sourcekod.fr/api/health
3. **Redirect WWW** : https://www.techpulse.sourcekod.fr → https://techpulse.sourcekod.fr
4. **HTTP Redirect** : http://techpulse.sourcekod.fr → https://techpulse.sourcekod.fr

### Tests SSL

```bash
# Test avec curl
curl -I https://techpulse.sourcekod.fr

# Test SSL Labs (dans le navigateur)
https://www.ssllabs.com/ssltest/analyze.html?d=techpulse.sourcekod.fr
```

## 🎯 Checklist de déploiement

- [ ] DNS configuré (A records pour apex et www)
- [ ] Node.js 20.x installé
- [ ] PM2 installé et configuré
- [ ] Nginx installé et configuré
- [ ] Certbot installé
- [ ] Repository cloné dans `/var/www/techpulse`
- [ ] Fichier `.env` configuré avec toutes les variables
- [ ] Build frontend et backend réussis
- [ ] Application démarrée avec PM2
- [ ] Configuration Nginx HTTP active
- [ ] Certificat SSL généré avec Certbot
- [ ] Configuration Nginx HTTPS active
- [ ] Redirections HTTP→HTTPS fonctionnelles
- [ ] Redirections WWW→non-WWW fonctionnelles
- [ ] Firewall configuré (ports 80, 443, 22)
- [ ] PM2 startup configuré pour le redémarrage auto
- [ ] Script `deploy.sh` configuré et testé

## 📞 Support

Pour toute question ou problème, consultez :
- Documentation Nginx : https://nginx.org/en/docs/
- Documentation PM2 : https://pm2.keymetrics.io/docs/usage/quick-start/
- Documentation Certbot : https://certbot.eff.org/

## 🔗 Liens utiles

- **Site de production** : https://techpulse.sourcekod.fr
- **SSL Test** : https://www.ssllabs.com/ssltest/
- **DNS Propagation** : https://dnschecker.org/

---

**Note** : Ce guide suppose une installation sur Ubuntu/Debian. Pour d'autres distributions, adaptez les commandes de gestion de paquets.
