import { Query } from "mongoose";
import logger from "./logger";

/**
 * Analyze query performance using MongoDB's explain()
 * Use this to understand and optimize slow queries
 */
export async function analyzeQuery<T>(
  query: Query<T, any>,
  queryName: string = "Query"
): Promise<T> {
  try {
    // Execute the query with explain to get execution stats
    const explanation: any = await query.explain("executionStats");

    // Extract relevant metrics
    const stats = explanation.executionStats;
    const executionTimeMs = stats.executionTimeMs;
    const totalDocsExamined = stats.totalDocsExamined;
    const totalKeysExamined = stats.totalKeysExamined;
    const nReturned = stats.nReturned;

    // Calculate efficiency ratio (how many docs examined vs returned)
    const efficiencyRatio =
      nReturned > 0 ? totalDocsExamined / nReturned : totalDocsExamined;

    // Log warning if query is inefficient
    if (executionTimeMs > 100 || efficiencyRatio > 10) {
      logger.warn(`Slow/Inefficient Query: ${queryName}`, {
        executionTimeMs,
        totalDocsExamined,
        totalKeysExamined,
        nReturned,
        efficiencyRatio: efficiencyRatio.toFixed(2),
        indexesUsed: stats.executionStages.indexName || "COLLSCAN",
      });
    } else {
      logger.debug(`Query Analysis: ${queryName}`, {
        executionTimeMs,
        nReturned,
        indexUsed: stats.executionStages.indexName || "COLLSCAN",
      });
    }

    // Now execute the actual query
    return await query.exec();
  } catch (error) {
    logger.error(`Query Analysis Error: ${queryName}`, error);
    // Fall back to executing the query without analysis
    return await query.exec();
  }
}

/**
 * Get profiling data from MongoDB system.profile collection
 * Shows slow queries that have been logged
 */
export async function getSlowQueries(limit: number = 10) {
  try {
    const mongoose = require("mongoose");
    const db = mongoose.connection.db;

    if (!db) {
      logger.warn("Database connection not available");
      return [];
    }

    // Query the system.profile collection
    const slowQueries = await db
      .collection("system.profile")
      .find({
        millis: { $gte: 100 }, // Queries taking > 100ms
      })
      .sort({ ts: -1 }) // Most recent first
      .limit(limit)
      .toArray();

    return slowQueries.map((query: any) => ({
      timestamp: query.ts,
      operation: query.op,
      namespace: query.ns,
      durationMs: query.millis,
      command: query.command,
      docsExamined: query.docsExamined,
      keysExamined: query.keysExamined,
      planSummary: query.planSummary,
    }));
  } catch (error) {
    logger.error("Error fetching slow queries:", error);
    return [];
  }
}

/**
 * Measure query execution time
 * Wrapper function to time any async database operation
 */
export async function measureQueryTime<T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const executionTime = Date.now() - startTime;

    if (executionTime > 100) {
      logger.warn(`Slow Query: ${queryName}`, {
        executionTimeMs: executionTime,
      });
    } else {
      logger.debug(`Query Executed: ${queryName}`, {
        executionTimeMs: executionTime,
      });
    }

    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error(`Query Failed: ${queryName}`, {
      executionTimeMs: executionTime,
      error,
    });
    throw error;
  }
}

/**
 * Check if indexes are being used efficiently
 */
export function logIndexUsage(queryPlan: any, queryName: string) {
  const stage = queryPlan.executionStats.executionStages;

  if (stage.stage === "COLLSCAN") {
    logger.warn(`Collection Scan Detected: ${queryName}`, {
      message: "Query is not using an index - consider adding one",
      collection: queryPlan.executionStats.namespace,
    });
  }

  if (stage.indexName) {
    logger.debug(`Index Used: ${queryName}`, {
      indexName: stage.indexName,
      keysExamined: queryPlan.executionStats.totalKeysExamined,
      docsExamined: queryPlan.executionStats.totalDocsExamined,
    });
  }
}
