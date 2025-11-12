import { NextFunction, Request, Response } from "express";
import { CandidateFirestoreService } from "../services/firestore/candidate.service";
import { JobFirestoreService } from "../services/firestore/job.service";
import logger from "../utils/logger";

/**
 * Dual Write Middleware
 * Writes data to both MongoDB (primary) and Firestore (secondary)
 * during the migration phase
 *
 * This ensures zero downtime and data consistency during migration
 */

interface DualWriteConfig {
  enabled: boolean;
  logFailures: boolean;
  throwOnFirestoreError: boolean; // If true, fails request if Firestore write fails
}

const config: DualWriteConfig = {
  enabled: process.env.DUAL_WRITE_ENABLED === "true",
  logFailures: true,
  throwOnFirestoreError: false, // Don't break MongoDB writes if Firestore fails
};

/**
 * Helper to extract company ID from request
 */
// function getCompanyId(req: Request): string | null {
//   // Try to get from authenticated user
//   if (req.user && (req.user as any).companyId) {
//     return (req.user as any).companyId;
//   }

//   // Try to get from request body
//   if (req.body && req.body.companyId) {
//     return req.body.companyId;
//   }

//   // Try to get from query params
//   if (req.query && req.query.companyId) {
//     return req.query.companyId as string;
//   }

//   return null;
// }

/**
 * Dual write for candidate creation/updates
 */
export async function dualWriteCandidate(
  operation: "create" | "update" | "delete",
  candidateData: any,
  candidateId?: string
): Promise<void> {
  if (!config.enabled) {
    return;
  }

  try {
    const candidateService = new CandidateFirestoreService();

    switch (operation) {
      case "create":
        if (candidateId) {
          await candidateService.createWithId(candidateId, candidateData);
        } else {
          await candidateService.create(candidateData);
        }
        logger.debug(`Dual write: Created candidate in Firestore`);
        break;

      case "update":
        if (!candidateId) {
          throw new Error("Candidate ID required for update operation");
        }
        await candidateService.update(candidateId, candidateData);
        logger.debug(
          `Dual write: Updated candidate ${candidateId} in Firestore`
        );
        break;

      case "delete":
        if (!candidateId) {
          throw new Error("Candidate ID required for delete operation");
        }
        await candidateService.delete(candidateId);
        logger.debug(
          `Dual write: Deleted candidate ${candidateId} from Firestore`
        );
        break;
    }
  } catch (error) {
    if (config.logFailures) {
      logger.error("Dual write to Firestore failed for candidate:", error);
    }
    if (config.throwOnFirestoreError) {
      throw error;
    }
  }
}

/**
 * Dual write for job creation/updates
 */
export async function dualWriteJob(
  operation: "create" | "update" | "delete",
  jobData: any,
  jobId?: string
): Promise<void> {
  if (!config.enabled) {
    return;
  }

  try {
    const jobService = new JobFirestoreService();

    switch (operation) {
      case "create":
        if (jobId) {
          await jobService.createWithId(jobId, jobData);
        } else {
          await jobService.create(jobData);
        }
        logger.debug(`Dual write: Created job in Firestore`);
        break;

      case "update":
        if (!jobId) {
          throw new Error("Job ID required for update operation");
        }
        await jobService.update(jobId, jobData);
        logger.debug(`Dual write: Updated job ${jobId} in Firestore`);
        break;

      case "delete":
        if (!jobId) {
          throw new Error("Job ID required for delete operation");
        }
        await jobService.delete(jobId);
        logger.debug(`Dual write: Deleted job ${jobId} from Firestore`);
        break;
    }
  } catch (error) {
    if (config.logFailures) {
      logger.error("Dual write to Firestore failed for job:", error);
    }
    if (config.throwOnFirestoreError) {
      throw error;
    }
  }
}

/**
 * Express middleware to intercept and dual-write responses
 * Attach to specific routes that need dual writing
 */
export function dualWriteMiddleware(modelType: "candidate" | "job") {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) {
      return next();
    }

    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to intercept response
    res.json = function (data: any): Response {
      // Execute dual write asynchronously (don't block response)
      setImmediate(async () => {
        try {
          if (data && data._id) {
            const operation =
              req.method === "POST"
                ? "create"
                : req.method === "PUT"
                  ? "update"
                  : "delete";

            if (modelType === "candidate") {
              await dualWriteCandidate(operation, data, data._id.toString());
            } else if (modelType === "job") {
              await dualWriteJob(operation, data, data._id.toString());
            }
          }
        } catch (error) {
          logger.error("Dual write middleware error:", error);
        }
      });

      // Return original response immediately
      return originalJson(data);
    };

    next();
  };
}

/**
 * Enable/disable dual write at runtime
 */
export function setDualWriteEnabled(enabled: boolean): void {
  config.enabled = enabled;
  logger.info(`Dual write ${enabled ? "enabled" : "disabled"}`);
}

/**
 * Get dual write configuration
 */
export function getDualWriteConfig(): DualWriteConfig {
  return { ...config };
}
