import { Router } from 'express';
import { emailAutomationJob } from '../jobs/emailAutomation.job';

const router = Router();

/**
 * GET /api/email-automation/status
 * Get email automation status
 */
router.get('/status', (_req, res) => {
  try {
    const status = emailAutomationJob.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to get automation status',
      error: error.message,
    });
  }
});

/**
 * POST /api/email-automation/enable
 * Enable email automation
 */
router.post('/enable', (_req, res) => {
  try {
    emailAutomationJob.enable();
    res.json({
      success: true,
      message: 'Email automation enabled',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to enable automation',
      error: error.message,
    });
  }
});

/**
 * POST /api/email-automation/disable
 * Disable email automation
 */
router.post('/disable', (_req, res) => {
  try {
    emailAutomationJob.disable();
    res.json({
      success: true,
      message: 'Email automation disabled',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to disable automation',
      error: error.message,
    });
  }
});

/**
 * POST /api/email-automation/trigger
 * Manually trigger email processing
 */
router.post('/trigger', async (_req, res) => {
  try {
    await emailAutomationJob.triggerManual();
    res.json({
      success: true,
      message: 'Email processing triggered successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to trigger email processing',
      error: error.message,
    });
  }
});

export default router;
