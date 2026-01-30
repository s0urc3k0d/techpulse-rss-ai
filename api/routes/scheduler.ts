import express from 'express';
import { triggerManualScraping, triggerBlogFeedUpdate } from '../scheduler.js';

const router = express.Router();

/**
 * POST /api/scheduler/trigger
 * Trigger manual scraping and email send
 */
router.post('/trigger', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        error: 'Email address is required',
        example: { email: 'user@example.com' }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Trigger scraping asynchronously
    triggerManualScraping(email).catch(error => {
      console.error('Error in manual scraping:', error);
    });

    res.json({ 
      message: 'Manual scraping triggered successfully',
      email,
      note: 'You will receive an email when the process is complete'
    });
  } catch (error: any) {
    console.error('Error triggering manual scraping:', error);
    res.status(500).json({ 
      error: 'Failed to trigger scraping',
      message: error.message 
    });
  }
});

/**
 * POST /api/scheduler/blog-feed
 * Trigger manual blog feed update (fetch, categorize, save)
 */
router.post('/blog-feed', async (req, res) => {
  try {
    const { feeds } = req.body;
    
    // Trigger update asynchronously
    triggerBlogFeedUpdate(feeds).catch(error => {
      console.error('Error in blog feed update:', error);
    });

    res.json({ 
      message: 'Blog feed update triggered successfully',
      note: 'Articles will be fetched, categorized and saved to the blog feed'
    });
  } catch (error: any) {
    console.error('Error triggering blog feed update:', error);
    res.status(500).json({ 
      error: 'Failed to trigger blog feed update',
      message: error.message 
    });
  }
});

/**
 * GET /api/scheduler/status
 * Get scheduler configuration status
 */
router.get('/status', (req, res) => {
  const config = {
    enabled: process.env.SCHEDULER_ENABLED === 'true',
    cronExpression: process.env.SCHEDULER_CRON || '0 9 * * *',
    timezone: process.env.SCHEDULER_TIMEZONE || 'Europe/Paris',
    emailConfigured: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER),
    runOnStart: process.env.SCHEDULER_RUN_ON_START === 'true',
    blogFeedAutoSave: process.env.BLOG_FEED_AUTO_SAVE === 'true',
  };

  res.json({
    status: 'ok',
    scheduler: config,
    nextRun: config.enabled ? getNextCronRun(config.cronExpression) : null
  });
});

/**
 * Helper to get next cron run time
 */
function getNextCronRun(cronExpression: string): string {
  // Simple calculation for daily 9 AM cron (0 9 * * *)
  const now = new Date();
  const next = new Date();
  next.setHours(9, 0, 0, 0);
  
  if (now.getHours() >= 9) {
    // If past 9 AM today, schedule for tomorrow
    next.setDate(next.getDate() + 1);
  }
  
  return next.toISOString();
}

export const schedulerRouter = router;
