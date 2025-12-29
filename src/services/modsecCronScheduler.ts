import cron from "node-cron";
import { processAllModsecLandingRecords } from "./modsecProcessor";

/**
 * Cron scheduler for processing ModSec landing records
 * 
 * Environment variables:
 *   - ENABLE_MODSEC_CRON: Enable/disable cron (default: "true")
 *   - MODSEC_CRON_SCHEDULE: Cron schedule (default: every 5 minutes)
 *   - BATCH_SIZE: Number of records to process per run (default: 100)
 */
class ModsecCronScheduler {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the cron scheduler
   */
  start(): void {
    const enabled = process.env.ENABLE_MODSEC_CRON !== "false";
    const schedule = process.env.MODSEC_CRON_SCHEDULE || "*/5 * * * *"; // Default: every 5 minutes

    if (!enabled) {
      console.log("⏸️  ModSec cron scheduler is disabled (ENABLE_MODSEC_CRON=false)");
      return;
    }

    // Validate cron schedule
    if (!cron.validate(schedule)) {
      console.error(`❌ Invalid cron schedule: ${schedule}`);
      return;
    }

    console.log(`⏰ Starting ModSec cron scheduler with schedule: ${schedule}`);

    this.task = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        console.log("⏳ ModSec processing already in progress, skipping this run...");
        return;
      }

      this.isRunning = true;
      const startTime = Date.now();

      try {
        const batchSize = parseInt(process.env.BATCH_SIZE || "100", 10);

        console.log(`🕐 [${new Date().toISOString()}] Starting ModSec processing cron job...`);
        console.log(`   Batch size: ${batchSize}`);

        // Count unprocessed records
        const { prisma } = await import("../lib/prisma");
        const unprocessedCount = await prisma.modsecLanding.count({
          where: { processed: false },
        });

        if (unprocessedCount === 0) {
          console.log("   ✅ No records to process");
          return;
        }

        console.log(`   📊 Found ${unprocessedCount} unprocessed records`);

        // Process records (no organization ID - logs will be created without org assignment)
        const result = await processAllModsecLandingRecords(
          undefined,
          batchSize
        );

        const duration = Date.now() - startTime;
        console.log(`   ✅ Successfully processed: ${result.processed}`);
        console.log(`   ❌ Failed: ${result.failed}`);
        console.log(`   ⏱️  Duration: ${duration}ms`);

        if (result.errors.length > 0 && result.errors.length <= 10) {
          console.log(`   ⚠️  Errors:`);
          result.errors.forEach((error) => {
            console.log(`      - ID ${error.id}: ${error.error.substring(0, 100)}`);
          });
        } else if (result.errors.length > 10) {
          console.log(`   ⚠️  ${result.errors.length} errors (too many to display)`);
        }

        console.log(`✅ [${new Date().toISOString()}] Cron job completed`);
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ [${new Date().toISOString()}] Cron job error (${duration}ms):`, error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    console.log("✅ ModSec cron scheduler started successfully");
  }

  /**
   * Stop the cron scheduler
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log("⏹️  ModSec cron scheduler stopped");
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { running: boolean; isProcessing: boolean } {
    return {
      running: this.task !== null,
      isProcessing: this.isRunning,
    };
  }
}

// Export singleton instance
export const modsecCronScheduler = new ModsecCronScheduler();

