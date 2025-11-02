import express from "express";
import {
  createDraft,
  deleteEmail,
  getCandidateEmails,
  getEmailById,
  getEmails,
  getEmailStats,
  getEmailThread,
  getInboundEmails,
  sendDraft,
  sendEmail,
  updateDraft,
} from "../controllers/email.controller";
// import emailAutomationJob from "../jobs/emailAutomation.job"; // TODO: Reimplement with Firestore
import { authenticate, requireRole } from "../middleware/auth";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/emails/stats
 * @desc    Get email statistics
 * @access  Recruiter, Admin, Super Admin
 */
router.get("/stats", requireRole("recruiter", "admin"), getEmailStats);

/**
 * @route   GET /api/emails/thread/:threadId
 * @desc    Get email thread
 * @access  All authenticated users
 */
router.get("/thread/:threadId", getEmailThread);

/**
 * @route   GET /api/emails/inbound
 * @desc    Get all inbound emails (candidate replies)
 * @access  All authenticated users
 */
router.get("/inbound", getInboundEmails);

/**
 * @route   GET /api/emails/candidate/:candidateId
 * @desc    Get all emails for a candidate
 * @access  All authenticated users
 */
router.get("/candidate/:candidateId", getCandidateEmails);

/**
 * @route   GET /api/emails
 * @desc    Get all emails with filters
 * @access  All authenticated users
 */
router.get("/", getEmails);

/**
 * @route   GET /api/emails/:id
 * @desc    Get email by ID
 * @access  All authenticated users
 */
router.get("/:id", getEmailById);

/**
 * @route   POST /api/emails
 * @desc    Send new email
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.post(
  "/",
  requireRole("recruiter", "hiring_manager", "admin"),
  sendEmail
);

/**
 * @route   POST /api/emails/draft
 * @desc    Create draft email
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.post(
  "/draft",
  requireRole("recruiter", "hiring_manager", "admin"),
  createDraft
);

/**
 * @route   PUT /api/emails/draft/:id
 * @desc    Update draft email
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.put(
  "/draft/:id",
  requireRole("recruiter", "hiring_manager", "admin"),
  updateDraft
);

/**
 * @route   PATCH /api/emails/draft/:id
 * @desc    Update draft email (partial)
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.patch(
  "/draft/:id",
  requireRole("recruiter", "hiring_manager", "admin"),
  updateDraft
);

/**
 * @route   POST /api/emails/draft/:id/send
 * @desc    Send draft email
 * @access  Recruiter, Hiring Manager, Admin, Super Admin
 */
router.post(
  "/draft/:id/send",
  requireRole("recruiter", "hiring_manager", "admin"),
  sendDraft
);

/**
 * @route   DELETE /api/emails/:id
 * @desc    Delete email
 * @access  Admin, Super Admin
 */
router.delete("/:id", requireRole("admin"), deleteEmail);

// ============================================
// EMAIL AUTOMATION ROUTES (for frontend Settings > Email Automation tab)
// ============================================

// TODO: Re-implement email automation routes with Firestore
/*
router.get("/automation/status", requireRole("admin"), async (_req, res) => {
  try {
    const status = await emailAutomationJob.getStats();
    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to get automation status",
      error: error.message,
    });
  }
});

router.post("/automation/start", requireRole("admin"), async (req, res) => {
  try {
    const userId = req.user?.id;
    await emailAutomationJob.enable(userId);
    res.json({
      success: true,
      message: "Email automation enabled and saved to database",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to enable automation",
      error: error.message,
    });
  }
});

router.post("/automation/stop", requireRole("admin"), async (req, res) => {
  try {
    const userId = req.user?.id;
    await emailAutomationJob.disable(userId);
    res.json({
      success: true,
      message: "Email automation disabled and saved to database",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to disable automation",
      error: error.message,
    });
  }
});

router.post("/automation/enable", requireRole("admin"), async (req, res) => {
  try {
    const userId = req.user?.id;
    await emailAutomationJob.enable(userId);
    res.json({
      success: true,
      message: "Email automation enabled and saved to database",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to enable automation",
      error: error.message,
    });
  }
});

router.post("/automation/disable", requireRole("admin"), async (req, res) => {
  try {
    const userId = req.user?.id;
    await emailAutomationJob.disable(userId);
    res.json({
      success: true,
      message: "Email automation disabled and saved to database",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to disable automation",
      error: error.message,
    });
  }
});

router.post("/automation/trigger", requireRole("admin"), async (_req, res) => {
  try {
    await emailAutomationJob.triggerManual();
    res.json({
      success: true,
      message: "Email processing triggered successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to trigger email processing",
      error: error.message,
    });
  }
});
*/

export default router;
