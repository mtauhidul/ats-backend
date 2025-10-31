// routes/applications.js - Routes for managing job applications

const express = require("express");
const router = express.Router();
const { validateApiKey } = require("../middleware/auth");
const { 
  validate, 
  getApplicationsSchema,
  createApplicationSchema,
  updateApplicationSchema 
} = require("../middleware/validation");
const logger = require("../utils/logger");
const { db } = require("../services/firebaseService");

// Apply auth middleware to all routes
router.use(validateApiKey);

/**
 * Get all applications with filtering and pagination
 * @route GET /api/applications
 * @desc Retrieve applications with optional filters
 * @access Private
 */
router.get("/", validate(getApplicationsSchema), async (req, res) => {
  try {
    const {
      limit = 20,
      page = 1,
      status,
      jobId,
      candidateId,
      source,
      minScore,
      maxScore,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    let query = db.collection("applications");

    // Apply validated filters (Zod already validated these)
    if (status) {
      query = query.where("status", "==", status);
    }

    if (jobId) {
      query = query.where("jobId", "==", jobId);
    }

    if (candidateId) {
      query = query.where("candidateId", "==", candidateId);
    }

    if (source) {
      query = query.where("source", "==", source);
    }

    if (minScore !== undefined) {
      query = query.where("score", ">=", parseFloat(minScore));
    }

    if (maxScore !== undefined) {
      query = query.where("score", "<=", parseFloat(maxScore));
    }

    if (startDate) {
      query = query.where("createdAt", ">=", new Date(startDate));
    }

    if (endDate) {
      query = query.where("createdAt", "<=", new Date(endDate));
    }

    // Apply sorting
    query = query.orderBy(sortBy, sortOrder);

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.limit(parseInt(limit)).offset(offset);

    const snapshot = await query.get();

    const applications = [];
    snapshot.forEach((doc) => {
      applications.push({ id: doc.id, ...doc.data() });
    });

    // Get total count for pagination
    const totalSnapshot = await db.collection("applications").get();
    const total = totalSnapshot.size;

    res.json({
      success: true,
      data: {
        applications,
        total,
        hasMore: offset + applications.length < total,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching applications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch applications",
      details: error.message,
    });
  }
});

/**
 * Get a specific application by ID
 * @route GET /api/applications/:id
 * @desc Get application details
 * @access Private
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection("applications").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
      });
    }

    res.json({
      success: true,
      data: { id: doc.id, ...doc.data() },
    });
  } catch (error) {
    logger.error("Error fetching application:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch application",
      details: error.message,
    });
  }
});

/**
 * Update application status or review information
 * @route PUT /api/applications/:id
 * @desc Update application
 * @access Private
 */
router.put("/:id", validate(updateApplicationSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if application exists
    const doc = await db.collection("applications").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
      });
    }

    // Add update timestamp
    updates.updatedAt = new Date().toISOString();

    // If status is being updated, add metadata
    if (updates.status) {
      updates.statusUpdatedAt = new Date().toISOString();
    }

    // If score is being updated, add review metadata
    if (updates.score !== undefined) {
      updates.reviewedAt = new Date().toISOString();
      // Add reviewedBy if available from auth context
      if (req.user?.id) {
        updates.reviewedBy = req.user.id;
      }
    }

    await db.collection("applications").doc(id).update(updates);

    // Get the updated document
    const updatedDoc = await db.collection("applications").doc(id).get();

    res.json({
      success: true,
      data: { id: updatedDoc.id, ...updatedDoc.data() },
    });
  } catch (error) {
    logger.error("Error updating application:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update application",
      details: error.message,
    });
  }
});

/**
 * Convert application to candidate
 * @route POST /api/applications/:id/convert
 * @desc Convert approved application to candidate
 * @access Private
 */
router.post("/:id/convert", async (req, res) => {
  try {
    const { id } = req.params;
    const { stageId, assignedTo } = req.body;

    // Get the application
    const appDoc = await db.collection("applications").doc(id).get();

    if (!appDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
      });
    }

    const applicationData = appDoc.data();

    // Create candidate data from application
    const candidateData = {
      ...applicationData,
      // Remove application-specific fields
      reviewStatus: undefined,
      reviewedBy: undefined,
      reviewedAt: undefined,
      reviewNotes: undefined,
      // Add candidate-specific fields
      stageId: stageId || "",
      assignedTo: assignedTo || "",
      convertedFromApplication: id,
      convertedAt: new Date().toISOString(),
      // Update source to reflect it came from application review
      source: "application_conversion",
      // Add history entry
      history: [
        ...(applicationData.history || []),
        {
          date: new Date().toISOString(),
          note: `Converted from application to candidate`,
        },
      ],
    };

    // Add candidate to candidates collection
    const candidateRef = db.collection("candidates").doc();
    await candidateRef.set({
      ...candidateData,
      id: candidateRef.id,
    });

    // Update application status to converted
    await db.collection("applications").doc(id).update({
      status: "converted",
      reviewStatus: "approved",
      convertedToCandidateId: candidateRef.id,
      convertedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: {
        candidateId: candidateRef.id,
        applicationId: id,
        message: "Application successfully converted to candidate",
      },
    });
  } catch (error) {
    logger.error("Error converting application to candidate:", error);
    res.status(500).json({
      success: false,
      error: "Failed to convert application",
      details: error.message,
    });
  }
});

/**
 * Reject application
 * @route POST /api/applications/:id/reject
 * @desc Reject an application
 * @access Private
 */
router.post("/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await db
      .collection("applications")
      .doc(id)
      .update({
        status: "rejected",
        reviewStatus: "rejected",
        rejectionReason: reason || "",
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    res.json({
      success: true,
      message: "Application rejected successfully",
    });
  } catch (error) {
    logger.error("Error rejecting application:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject application",
      details: error.message,
    });
  }
});

/**
 * Get applications statistics
 * @route GET /api/applications/stats
 * @desc Get application statistics
 * @access Private
 */
router.get("/stats", async (req, res) => {
  try {
    const { period = "7d" } = req.query;

    // Calculate date range
    const periodHours = { "24h": 24, "7d": 168, "30d": 720 }[period] || 168;
    const sinceDate = new Date(Date.now() - periodHours * 60 * 60 * 1000);

    // Get applications since the specified period
    const snapshot = await db
      .collection("applications")
      .where("createdAt", ">=", sinceDate.toISOString())
      .get();

    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      converted: 0,
      bySource: {},
      dailyBreakdown: {},
    };

    snapshot.forEach((doc) => {
      const data = doc.data();
      stats.total++;

      // Count by status
      if (data.reviewStatus === "unreviewed") stats.pending++;
      else if (data.reviewStatus === "approved") stats.approved++;
      else if (data.reviewStatus === "rejected") stats.rejected++;

      if (data.status === "converted") stats.converted++;

      // Count by source
      const source = data.source || "unknown";
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;

      // Daily breakdown
      const day = new Date(data.createdAt).toISOString().split("T")[0];
      stats.dailyBreakdown[day] = (stats.dailyBreakdown[day] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        period,
        since: sinceDate.toISOString(),
        stats,
      },
    });
  } catch (error) {
    logger.error("Error fetching application statistics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
      details: error.message,
    });
  }
});

/**
 * Delete application
 * @route DELETE /api/applications/:id
 * @desc Delete an application
 * @access Private
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("applications").doc(id).delete();

    res.json({
      success: true,
      message: "Application deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting application:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete application",
      details: error.message,
    });
  }
});

module.exports = router;
