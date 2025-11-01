/**
 * Script to analyze slow queries from MongoDB profiler
 * Run with: npm run ts-node scripts/analyze-slow-queries.ts
 */
import mongoose from "mongoose";
import { config } from "../src/config";
import logger from "../src/utils/logger";

async function analyzeSlowQueries() {
  try {
    // Connect to database
    await mongoose.connect(config.mongodb.uri);
    logger.info("✅ Connected to MongoDB");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection not available");
    }

    // Check profiling status
    const profilingStatus = await db.command({ profile: -1 });
    logger.info("Profiling Status:", profilingStatus);

    // Get slow queries from system.profile collection
    const slowQueries = await db
      .collection("system.profile")
      .find({
        millis: { $gte: 100 }, // Queries taking > 100ms
      })
      .sort({ ts: -1 }) // Most recent first
      .limit(20)
      .toArray();

    if (slowQueries.length === 0) {
      logger.info("✅ No slow queries found (> 100ms)");
      return;
    }

    logger.info(`\n📊 Found ${slowQueries.length} slow queries:\n`);

    // Group by collection and operation
    const queryStats = new Map<string, any>();

    slowQueries.forEach((query: any) => {
      const key = `${query.ns}.${query.op}`;

      if (!queryStats.has(key)) {
        queryStats.set(key, {
          namespace: query.ns,
          operation: query.op,
          count: 0,
          totalTime: 0,
          maxTime: 0,
          avgDocsExamined: 0,
          examples: [],
        });
      }

      const stats = queryStats.get(key);
      stats.count++;
      stats.totalTime += query.millis;
      stats.maxTime = Math.max(stats.maxTime, query.millis);
      stats.avgDocsExamined += query.docsExamined || 0;

      if (stats.examples.length < 3) {
        stats.examples.push({
          timestamp: query.ts,
          duration: query.millis,
          command: query.command,
          planSummary: query.planSummary,
        });
      }
    });

    // Print summary
    console.log("\n" + "=".repeat(80));
    console.log("SLOW QUERY SUMMARY");
    console.log("=".repeat(80) + "\n");

    Array.from(queryStats.values())
      .sort((a, b) => b.totalTime - a.totalTime)
      .forEach((stats) => {
        console.log(`📍 ${stats.namespace} - ${stats.operation}`);
        console.log(`   Count: ${stats.count}`);
        console.log(`   Total Time: ${stats.totalTime}ms`);
        console.log(`   Max Time: ${stats.maxTime}ms`);
        console.log(
          `   Avg Time: ${(stats.totalTime / stats.count).toFixed(2)}ms`
        );
        console.log(
          `   Avg Docs Examined: ${(stats.avgDocsExamined / stats.count).toFixed(0)}`
        );

        console.log("\n   Examples:");
        stats.examples.forEach((example: any, i: number) => {
          console.log(`   ${i + 1}. ${example.duration}ms`);
          console.log(`      Plan: ${example.planSummary || "N/A"}`);
          if (example.command) {
            console.log(
              `      Query: ${JSON.stringify(example.command).substring(0, 100)}...`
            );
          }
        });
        console.log("");
      });

    console.log("=".repeat(80));
    console.log(
      "\n💡 Recommendations:\n" +
        "   1. Review queries with COLLSCAN plan (no index used)\n" +
        "   2. Add indexes for frequently slow queries\n" +
        "   3. Consider query optimization or data model changes\n" +
        "   4. Use .lean() for read-only queries\n" +
        "   5. Add field projections with .select()\n"
    );

    // Get index usage stats
    console.log("\n" + "=".repeat(80));
    console.log("INDEX USAGE STATISTICS");
    console.log("=".repeat(80) + "\n");

    const collections = [
      "candidates",
      "jobs",
      "applications",
      "emails",
      "users",
    ];

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.indexes();
        const stats = await collection
          .aggregate([{ $indexStats: {} }])
          .toArray();

        console.log(`📂 ${collectionName}:`);
        console.log(`   Total Indexes: ${indexes.length}`);

        stats
          .sort((a: any, b: any) => b.accesses.ops - a.accesses.ops)
          .forEach((stat: any) => {
            const usagePercent = stats.length > 0 ? (stat.accesses.ops / Math.max(...stats.map((s: any) => s.accesses.ops))) * 100 : 0;
            const usageBar = "█".repeat(Math.floor(usagePercent / 5));

            console.log(
              `   - ${stat.name}: ${stat.accesses.ops} ops ${usageBar}`
            );
          });
        console.log("");
      } catch (error) {
        logger.warn(`Could not get stats for ${collectionName}:`, error);
      }
    }

    console.log("=".repeat(80) + "\n");
  } catch (error) {
    logger.error("❌ Error analyzing slow queries:", error);
  } finally {
    await mongoose.connection.close();
    logger.info("Database connection closed");
  }
}

// Run the analysis
analyzeSlowQueries();
