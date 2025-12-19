<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TechPulse AI — RSS News Aggregator with AI Categorization

Smart RSS aggregator that uses Google Gemini AI to automatically categorize tech news articles and generate podcast scripts.

## ✨ Features

- 📰 Multi-source RSS feed aggregation
- 🤖 AI-powered article categorization (9 tech categories)
- 🎙️ Automated podcast script generation
- 📅 Date range filtering
- 🎨 Modern dark UI with Tailwind CSS
- 🔒 Secure API key management (server-side only)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd techpulse-rss-ai
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your Gemini API key
GEMINI_API_KEY=your_actual_api_key_here
```

4. Start the development servers:
```bash
npm run dev
```

This will start:
- Frontend (Vite): http://localhost:3000
- Backend API: http://localhost:3001

### Production Build

```bash
# Build frontend
npm run build

# Build backend
npm run build:server

# Start production server
npm run start:server
```

## 🏗️ Architecture

### Project Structure

```
techpulse-rss-ai/
├── api/                    # Backend API (Express)
│   ├── server.ts          # Main server
│   └── routes/            # API endpoints
│       ├── categorize.ts  # Article categorization
│       └── generate-script.ts  # Podcast script generation
├── components/            # React components
│   ├── ArticleCard.tsx
│   ├── DateSelector.tsx
│   └── FeedManager.tsx
├── services/              # Frontend services
│   ├── apiService.ts      # API client (NEW)
│   ├── rssService.ts      # RSS fetching
│   └── geminiService.ts   # (DEPRECATED - use apiService)
├── App.tsx                # Main app component
├── types.ts               # TypeScript definitions
├── constants.ts           # App constants
└── index.css              # Global styles

```

### Security Architecture

**IMPORTANT**: The Gemini API key is now only used server-side. Never expose API keys in frontend code.

- ✅ API calls go through backend proxy (`/api/*`)
- ✅ Rate limiting (10 req/min per IP)
- ✅ Input validation and sanitization
- ✅ Environment variables only on server

## 📝 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in dev mode |
| `npm run dev:client` | Start only frontend (Vite) |
| `npm run dev:server` | Start only backend API |
| `npm run build` | Build frontend for production |
| `npm run build:server` | Build backend for production |
| `npm run check-env` | Validate environment variables |
| `npm run preview` | Preview production build locally |

## 🔧 Configuration

### Environment Variables

Create a `.env` file at the root with:

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key

# Optional
PORT=3001                       # Backend API port
NODE_ENV=development            # development | production
RATE_LIMIT_WINDOW_MS=60000     # Rate limit window (ms)
RATE_LIMIT_MAX_REQUESTS=10     # Max requests per window
```

### Adding RSS Feeds

Edit `constants.ts` to add default feeds, or use the UI to add feeds dynamically (they'll be saved in localStorage).

## 🎯 API Endpoints

### POST `/api/categorize`
Categorize articles using AI.

**Request:**
```json
{
  "articles": [
    {
      "id": "art_0",
      "title": "Article title",
      "description": "Article description..."
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "classifications": [
    {
      "id": "art_0",
      "category": "IA & Data"
    }
  ]
}
```

### POST `/api/generate-script`
Generate podcast script from articles.

**Request:**
```json
{
  "articles": [
    {
      "id": "art_0",
      "title": "Article title",
      "description": "Description...",
      "source": "TechCrunch"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "scriptItems": [
    {
      "originalId": "art_0",
      "catchyTitle": "Titre accrocheur",
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ]
}
```

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, TypeScript
- **AI**: Google Gemini 2.0 Flash
- **RSS Parsing**: DOMParser (native browser API)

## 📋 Roadmap

See [ROADMAP.md](./ROADMAP.md) for detailed improvement plans.

**Priority Critical**:
- ✅ Backend API for Gemini calls (DONE)
- ✅ Environment configuration normalization (DONE)

**Priority High**:
- [ ] RSS fetching improvements (concurrency, retries, deduplication)
- [ ] localStorage persistence
- [ ] AI batching and caching

See [ISSUES.md](./ISSUES.md) for detailed issue tracking.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- AI Studio: https://ai.studio/apps/drive/1Ik-T2DDx5qPSZqkoNPKQPoABy4H9f6SE
- Gemini API: https://aistudio.google.com/app/apikey

---

Made with ❤️ using Google Gemini AI
