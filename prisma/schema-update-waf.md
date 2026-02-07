# Schema Update for WAF Toggle Feature

## Current Schema Analysis

Looking at the existing `schema.prisma`:
- `Organization` has `domains String[]` (PostgreSQL array)
- `OrganizationMember` follows pattern: separate table with foreign key to Organization
- Uses `onDelete: Cascade` for cleanup
- Uses `@@index` for performance
- Uses `@@unique` for constraints

## Proposed Schema Addition

Following the exact same pattern as `OrganizationMember`:

```prisma
model Organization {
  id         String               @id @default(uuid())
  name       String
  domains    String[]
  ownerEmail String?
  status     String               @default("pending")
  createdAt  DateTime             @default(now())
  updatedAt  DateTime             @updatedAt
  logs       Log[]
  members    OrganizationMember[]
  domainWafStatuses DomainWAFStatus[]  // ADD THIS LINE
}

// ADD THIS ENTIRE MODEL
model DomainWAFStatus {
  id             String       @id @default(uuid())
  organizationId String
  domain         String       // Must match one of the domains in Organization.domains[]
  wafEnabled     Boolean      @default(true)  // Default: WAF enabled for security
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, domain])  // One status per domain per org
  @@index([organizationId])             // Fast lookup by org
  @@index([domain])                    // Fast lookup by domain
}
```

## Migration Strategy

1. **Create migration:**
   ```bash
   npx prisma migrate dev --name add_domain_waf_status
   ```

2. **Data Migration (for existing organizations):**
   - After creating the table, we need to populate it with default values
   - For each organization, create a `DomainWAFStatus` record for each domain in `domains[]`
   - Set `wafEnabled = true` by default (secure default)

3. **Validation:**
   - Ensure domain in `DomainWAFStatus.domain` exists in `Organization.domains[]`
   - This will be enforced in application logic (Prisma doesn't support array contains validation)

## Notes

- **Default WAF Status:** `true` (enabled) - security-first approach
- **Cascade Delete:** When organization is deleted, all WAF statuses are automatically deleted
- **Unique Constraint:** Prevents duplicate entries for same domain in same organization
- **Indexes:** Optimize queries for finding status by organization or domain

