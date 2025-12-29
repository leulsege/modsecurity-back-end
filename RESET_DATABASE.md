# Database Reset Guide

## Complete Database Reset (Delete All Data)

### Option 1: Using Prisma Reset (Recommended - Easiest)

This will:
- Drop all tables
- Delete all data
- Recreate all tables from migrations
- Run seed scripts (if configured)

```bash
npx prisma migrate reset --force
```

**Note:** This requires all migrations to be valid. If you get errors, use Option 2.

---

### Option 2: Manual Reset via Supabase SQL Editor

1. **Open Supabase Dashboard → SQL Editor**

2. **Run this SQL to drop all tables:**
```sql
-- Drop all tables (in order to respect foreign keys)
DROP TABLE IF EXISTS "Log" CASCADE;
DROP TABLE IF EXISTS "OrganizationMember" CASCADE;
DROP TABLE IF EXISTS "Organization" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "modsec_landing" CASCADE;
DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;
```

3. **Then run migrations:**
```bash
npx prisma migrate deploy
```

---

### Option 3: Clean Slate - Delete All Migrations and Start Fresh

1. **Delete all migration folders** (keep `migration_lock.toml`):
   ```bash
   # In PowerShell
   Get-ChildItem -Path "prisma\migrations" -Directory | Where-Object { $_.Name -ne "migration_lock.toml" } | Remove-Item -Recurse -Force
   ```

2. **Drop all tables** (use SQL from Option 2)

3. **Create fresh migration:**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

---

## After Reset

1. **Verify tables exist:**
   ```bash
   npx prisma studio
   ```

2. **Seed data (optional):**
   ```bash
   npm run seed
   ```

3. **Re-insert modsec_landing data** (if you have backup)

---

## Current Schema Models

After reset, you'll have:
- ✅ `User` - User accounts
- ✅ `Organization` - Organizations
- ✅ `OrganizationMember` - User-Organization relationships
- ✅ `Log` - Security logs
- ✅ `ModsecLanding` - Raw ModSecurity data (tag, time, data, processed)

---

## Troubleshooting

If `prisma migrate reset` fails:
- Check your `.env` file has correct `DATABASE_URL` and `DIRECT_URL`
- Ensure you have proper database permissions
- Use Option 2 (Manual SQL) instead

