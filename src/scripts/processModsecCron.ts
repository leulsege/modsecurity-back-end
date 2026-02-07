import { PrismaClient } from "@prisma/client";
import { processAllModsecLandingRecords } from "../services/modsecProcessor";

const prisma = new PrismaClient();

/**
 * Cron job script to process modsec_landing records
 * 
 * Usage:
 *   - Add to crontab: Every 5 minutes: cd /path/to/project && npm run cron:modsec
 *   - Or use node-cron in Node.js
 *   - Or use systemd timer
 * 
 * Environment variables:
 *   - BATCH_SIZE (default: 100)
 */
async function main() {
  const batchSize = parseInt(process.env.BATCH_SIZE || "100", 10);

  console.log(`🕐 [${new Date().toISOString()}] Starting ModSec processing cron job...`);
  console.log(`   Batch size: ${batchSize}`);

  try {
    // Count unprocessed records
    const unprocessedCount = await prisma.modsecLanding.count({
      where: { processed: false },
    });

    if (unprocessedCount === 0) {
      console.log("   ✅ No records to process");
      return;
    }

    console.log(`   📊 Found ${unprocessedCount} unprocessed records`);

    // Process records (organization ID will be automatically matched by host domain)
    const result = await processAllModsecLandingRecords(
      undefined,
      batchSize
    );

    console.log(`   ✅ Successfully processed: ${result.processed}`);
    console.log(`   ❌ Failed: ${result.failed}`);

    if (result.errors.length > 0 && result.errors.length <= 10) {
      console.log(`   ⚠️  Errors:`);
      result.errors.forEach((error) => {
        console.log(`      - ID ${error.id}: ${error.error}`);
      });
    } else if (result.errors.length > 10) {
      console.log(`   ⚠️  ${result.errors.length} errors (too many to display)`);
    }

    console.log(`✅ [${new Date().toISOString()}] Cron job completed`);
  } catch (error) {
    console.error(`❌ [${new Date().toISOString()}] Cron job error:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

