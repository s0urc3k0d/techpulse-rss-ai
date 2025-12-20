import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { categorizeRouter } from './routes/categorize.js';
import { generateScriptRouter } from './routes/generate-script.js';
import { schedulerRouter } from './routes/scheduler.js';
import { rssRouter } from './routes/rss.js';
import { initializeScheduler } from './scheduler.js';

const app = express();
const PORT = process.env.PORT || 5555;

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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/rss', rssRouter);
app.use('/api/categorize', categorizeRouter);
app.use('/api/scheduler', schedulerRouter);
app.use('/api/generate-script', generateScriptRouter);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  
  // Initialize scheduler
  initializeScheduler();
});

export default app;
