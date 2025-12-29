import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Script to check what tables exist in the database
 */
async function main() {
  try {
    console.log("🔍 Checking database tables...\n");

    // Use raw SQL to query information_schema
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log("📋 Tables found in database:");
    tables.forEach((table) => {
      console.log(`   - ${table.table_name}`);
    });

    // Check specifically for modsec related tables
    const modsecTables = tables.filter((t) =>
      t.table_name.toLowerCase().includes("modsec")
    );
    
    if (modsecTables.length > 0) {
      console.log("\n✅ ModSec related tables found:");
      modsecTables.forEach((table) => {
        console.log(`   - ${table.table_name}`);
      });
    } else {
      console.log("\n⚠️  No ModSec related tables found");
    }

    // If there's a modsec_landing table, check its structure
    const landingTable = tables.find(
      (t) => t.table_name.toLowerCase() === "modseclanding" || 
             t.table_name.toLowerCase() === "modsec_landing"
    );

    if (landingTable) {
      console.log(`\n📊 Checking structure of ${landingTable.table_name}...`);
      const columns = await prisma.$queryRaw<Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>>`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = ${landingTable.table_name}
        ORDER BY ordinal_position;
      `;

      console.log("   Columns:");
      columns.forEach((col) => {
        console.log(
          `   - ${col.column_name} (${col.data_type}) ${col.is_nullable === "NO" ? "NOT NULL" : "NULL"}`
        );
      });
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


