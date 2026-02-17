import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { categorizeRouter } from './routes/categorize.js';
import { generateScriptRouter } from './routes/generate-script.js';
import { schedulerRouter } from './routes/scheduler.js';
import { rssRouter } from './routes/rss.js';
import autoSelectRouter from './routes/auto-select.js';
import preparePodcastRouter from './routes/prepare-podcast.js';
import { feedsRouter } from './routes/feeds.js';
import { initializeScheduler } from './scheduler.js';
import { getProviderInfo } from './utils/aiProvider.js';

const app = express();
const PORT = process.env.PORT || 5555;

// Trust proxy for rate limiter behind nginx/reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    aiProvider: getProviderInfo()
  });
});

// Routes
app.use('/api/rss', rssRouter);
app.use('/api/categorize', categorizeRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/generate-script', generateScriptRouter);
app.use('/api/auto-select', autoSelectRouter);
app.use('/api/prepare-podcast', preparePodcastRouter);
app.use('/api/feeds', feedsRouter);

// Serve frontend in production (single-container deployment)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    app.use(express.static(distPath));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(indexPath);
    });
  } else {
    console.warn(`⚠️  Frontend build not found at ${indexPath}`);
  }
}

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    
    // Initialize scheduler
    initializeScheduler();
  });
}

export default app;
