#!/bin/bash
# TechPulse - Script de déploiement sur VPS
# Usage: ./deploy.sh

set -e  # Exit on error

# Configuration
APP_NAME="techpulse-api"
APP_DIR="/var/www/techpulse"
REPO_URL="https://github.com/votre-username/techpulse-rss-ai.git"  # À modifier
BRANCH="main"
NODE_VERSION="20"

echo "🚀 Déploiement de TechPulse..."

# 1. Pull latest code
echo "📥 Mise à jour du code..."
cd $APP_DIR
git pull origin $BRANCH

# 2. Install dependencies
echo "📦 Installation des dépendances..."
npm ci --legacy-peer-deps

# 3. Build frontend
echo "🏗️  Build du frontend..."
npm run build

# 4. Build backend
echo "🏗️  Build du backend..."
npm run build:server

# 5. Create logs directory if not exists
echo "📁 Création du répertoire logs..."
mkdir -p logs

# 6. Reload PM2
echo "🔄 Rechargement PM2..."
pm2 reload ecosystem.config.js --update-env
pm2 save

# 7. Check PM2 status
echo "✅ Statut PM2:"
pm2 status

# 8. Display logs
echo "📊 Derniers logs:"
pm2 logs $APP_NAME --lines 20 --nostream

echo "✨ Déploiement terminé avec succès!"
echo "🌐 Site: https://techpulse.sourcekod.fr"
