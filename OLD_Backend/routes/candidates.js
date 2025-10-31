// routes/candidates.js
const express = require("express");
const router = express.Router();
const firebaseService = require("../services/firebaseService");
const logger = require("../utils/logger");
const { validateApiKey } = require("../middleware/auth");
const { 
  validate, 
  getCandidatesSchema,
  createCandidateSchema,
  updateCandidateSchema 
} = require("../middleware/validation");

/* ------------------------------------------------------------------ */
/* GET /candidates/recent-imports ----------------------------------- */
/* ------------------------------------------------------------------ */
router.get("/recent-imports", validateApiKey, async (req, res) => {
  try {
    const { since, hours = 24 } = req.query;

    /* ---------- build “since” as a Date --------------------------- */
    let sinceDate;
    if (since) {
      sinceDate = new Date(since);
      if (isNaN(sinceDate)) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid date format for 'since'. Use an ISO-8601 string, e.g. 2025-06-24T00:00:00Z",
        });
      }
    } else {
      const hrs = Number(hours);
      if (!hrs || hrs < 1)
        return res.status(400).json({
          success: false,
          error: "'hours' must be a positive number.",
        });

      sinceDate = new Date(Date.now() - hrs * 60 * 60 * 1000);
    }

    logger.info(`Fetching imports since ${sinceDate.toISOString()}`);

    /* ---------- fetch from Firestore ------------------------------ */
    const candidates = await firebaseService.getCandidatesByTimeAndNote({
      since: sinceDate, // we pass the Date object
      notePattern: "Imported from email with subject:",
    });

    /* ---------- match email-import notes (allow optional quotes) --- */
    const emailImportRegex =
      /^Imported from email with subject:\s*"?JOB-\d+-[A-Z]+"?/i;

    const emailImported = candidates.filter((c) =>
      (c.history || []).some((h) => emailImportRegex.test(h?.note ?? ""))
    );

    const count = emailImported.length;
    logger.info(`Found ${count} email imports in the window.`);

    /* ---------- response ----------------------------------------- */
    res.json({
      success: true,
      data: {
        count,
        since: sinceDate.toISOString(),
        hoursBack: Math.round(
          (Date.now() - sinceDate.getTime()) / (60 * 60 * 1000)
        ),
        summary: {
          totalChecked: candidates.length,
          emailImported: count,
          jobReferences: emailImported.reduce((acc, c) => {
            const match = (c.history?.[0]?.note ?? "").match(/JOB-\d+-[A-Z]+/i);
            if (match) acc[match[0]] = (acc[match[0]] || 0) + 1;
            return acc;
          }, {}),
        },
      },
    });
  } catch (err) {
    logger.error("recent-imports failed:", err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch recent imports" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /candidates/stats -------------------------------------------- */
/* ------------------------------------------------------------------ */
router.get("/stats", validateApiKey, async (req, res) => {
  try {
    const period = req.query.period || "7d";
    const hoursMap = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };
    const periodHours = hoursMap[period] ?? 24 * 7;
    const sinceDate = new Date(Date.now() - periodHours * 60 * 60 * 1000);

    const all = await firebaseService.getCandidatesSince(sinceDate);

    /* ----------- build stats -------------------------------------- */
    const stats = {
      total: 0,
      emailImported: 0,
      manuallyAdded: 0,
      otherImports: 0,
      bySource: {},
      byJobReference: {},
      dailyBreakdown: {},
    };

    const emailImportRegex =
      /^Imported from email with subject:\s*"?JOB-\d+-[A-Z]+"?/i;

    all.forEach((c) => {
      stats.total++;
      const created = new Date(c.createdAt || c.importDate);
      const day = created.toISOString().slice(0, 10); // YYYY-MM-DD
      stats.dailyBreakdown[day] ??= { total: 0, emailImported: 0 };
      stats.dailyBreakdown[day].total++;

      const note =
        c.notes || c.note || (c.history?.find((h) => h.note)?.note ?? "");

      if (emailImportRegex.test(note)) {
        stats.emailImported++;
        stats.dailyBreakdown[day].emailImported++;
        stats.bySource.email = (stats.bySource.email || 0) + 1;

        const ref = note.match(/JOB-\d+-[A-Z]+/i)?.[0];
        if (ref)
          stats.byJobReference[ref] = (stats.byJobReference[ref] || 0) + 1;
      } else if (/manual/i.test(note)) {
        stats.manuallyAdded++;
        stats.bySource.manual = (stats.bySource.manual || 0) + 1;
      } else {
        stats.otherImports++;
        stats.bySource.other = (stats.bySource.other || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: { period, since: sinceDate.toISOString(), stats },
    });
  } catch (err) {
    logger.error("stats failed:", err);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

module.exports = router;
