import express from 'express';
import { triggerManualScraping, triggerBlogFeedUpdate, triggerSaturdayPodcastDigest } from '../scheduler.js';

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
 * Trigger manual blog feed update (fetch, categorize, auto-select top N/category, save)
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
      note: 'Articles will be fetched, categorized, auto-selected (top N/category) and saved to the blog feed'
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
 * POST /api/scheduler/podcast-saturday
 * Trigger manual Saturday podcast digest generation and email
 */
router.post('/podcast-saturday', async (req, res) => {
  try {
    const result = await triggerSaturdayPodcastDigest();

    res.json({
      message: result.success
        ? 'Saturday podcast digest terminé'
        : 'Saturday podcast digest terminé avec avertissements',
      note: result.emailSent
        ? 'Email envoyé avec succès'
        : 'Email non envoyé (voir détails)',
      result
    });
  } catch (error: any) {
    console.error('Error triggering Saturday podcast digest:', error);
    res.status(500).json({
      error: 'Failed to trigger Saturday podcast digest',
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

  const autoPipeline = {
    enabled: process.env.AUTO_PIPELINE_ENABLED !== 'false',
    cronExpression: process.env.AUTO_PIPELINE_CRON || '0 * * * *',
    maxPerCategory: parseInt(process.env.AUTO_SELECT_MAX_PER_CATEGORY || '5', 10),
    lookbackHours: parseInt(process.env.AUTO_PIPELINE_LOOKBACK_HOURS || '24', 10),
    runOnStart: process.env.AUTO_PIPELINE_RUN_ON_START === 'true',
    feedsConfigured: !!(process.env.AUTO_PIPELINE_FEEDS || process.env.SCHEDULER_FEEDS)
  };

  const saturdayPodcast = {
    enabled: process.env.SATURDAY_PODCAST_ENABLED === 'true',
    cronExpression: process.env.SATURDAY_PODCAST_CRON || '0 10 * * 6',
    timezone: process.env.SATURDAY_PODCAST_TIMEZONE || process.env.SCHEDULER_TIMEZONE || 'Europe/Paris',
    maxPerCategory: parseInt(process.env.SATURDAY_PODCAST_MAX_PER_CATEGORY || '2', 10),
    runOnStart: process.env.SATURDAY_PODCAST_RUN_ON_START === 'true',
    emailConfigured: !!(process.env.SATURDAY_PODCAST_EMAIL_TO || process.env.SCHEDULER_EMAIL_TO || process.env.EMAIL_USER)
  };

  res.json({
    status: 'ok',
    scheduler: config,
    autoPipeline,
    saturdayPodcast,
    nextRun: config.enabled ? getNextCronRun(config.cronExpression) : null,
    nextAutoPipelineRun: autoPipeline.enabled ? getNextCronRun(autoPipeline.cronExpression) : null,
    nextSaturdayPodcastRun: saturdayPodcast.enabled ? getNextCronRun(saturdayPodcast.cronExpression) : null
  });
});

/**
 * Helper to get next cron run time
 */
function getNextCronRun(cronExpression: string): string {
  const now = new Date();
  const parts = cronExpression.trim().split(/\s+/);

  if (parts.length !== 5) {
    return now.toISOString();
  }

  const [minutePart, hourPart] = parts;

  // Every hour at fixed minute: "m * * * *"
  if (hourPart === '*' && /^\d+$/.test(minutePart)) {
    const minute = parseInt(minutePart, 10);
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(minute);

    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }

    return next.toISOString();
  }

  // Daily at fixed hour/minute: "m h * * *"
  if (/^\d+$/.test(minutePart) && /^\d+$/.test(hourPart)) {
    const minute = parseInt(minutePart, 10);
    const hour = parseInt(hourPart, 10);
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.toISOString();
  }

  return now.toISOString();
}

export const schedulerRouter = router;
