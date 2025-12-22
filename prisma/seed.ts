import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file"
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("🌱 Starting seed...");

  // Get admin credentials from environment or use defaults
  const adminEmail = process.env.ADMIN_EMAIL || "yafet.zerihun@zergaw.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Test.123";
  const adminFullName = process.env.ADMIN_FULL_NAME || "Super Admin";
  const adminId =
    process.env.ADMIN_ID || "00000000-0000-0000-0000-000000000001";

  try {
    // Check if user already exists in our database
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      console.log(
        `✅ User ${adminEmail} already exists with role: ${
          existingUser.role || "null"
        }`
      );

      // Update to super_admin if not already
      if (existingUser.role !== "super_admin") {
        await prisma.user.update({
          where: { email: adminEmail },
          data: { role: "super_admin" },
        });
        console.log(`✅ Updated user ${adminEmail} to super_admin role`);
      }
      return;
    }

    // Try to sign up the user in Supabase Auth
    console.log(`📧 Creating user in Supabase Auth: ${adminEmail}`);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: adminEmail,
      password: adminPassword,
      options: {
        data: {
          full_name: adminFullName,
        },
      },
    });

    if (authError && !authError.message.includes("already registered")) {
      console.warn(`⚠️  Supabase signup warning: ${authError.message}`);
      console.log("ℹ️  Attempting to sign in instead...");

      // Try to sign in (user might already exist)
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: adminPassword,
        });

      if (signInError) {
        console.error(`❌ Error signing in: ${signInError.message}`);
        console.log(
          "ℹ️  Creating user in database only. Please create the user in Supabase Auth manually."
        );
      } else {
        console.log("✅ Successfully signed in to Supabase");
      }
    } else if (authData?.user) {
      console.log("✅ Successfully created user in Supabase Auth");
    }

    // Create user in our database
    console.log(`💾 Creating user in database: ${adminEmail}`);
    const user = await prisma.user.create({
      data: {
        id: adminId,
        email: adminEmail,
        fullName: adminFullName,
        role: "super_admin",
      },
    });

    console.log("✅ Seed completed successfully!");
    console.log(`\n📋 Admin User Details:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Full Name: ${user.fullName}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user.id}`);
    console.log(`\n🔑 Default Password: ${adminPassword}`);
    console.log(`\n⚠️  Please change the password after first login!`);
  } catch (error) {
    console.error("❌ Error during seed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
