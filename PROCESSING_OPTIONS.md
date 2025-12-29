# ModSec Landing Processing Options

## Current Problem

The API endpoint `/api/modsec/process` processes records synchronously, which means:
- ❌ Long response times for large batches
- ❌ Client has to wait for completion
- ❌ Risk of timeout on large datasets
- ❌ Not scalable for high-volume processing

## Better Alternatives

### Option 1: Background Worker Process (Recommended) ⭐

**Best for**: Continuous processing, real-time processing

Run a dedicated worker process that continuously polls and processes records:

```bash
# Start the worker
npm run worker:modsec
```

**Advantages:**
- ✅ Processes records automatically in background
- ✅ No API timeouts
- ✅ Can run 24/7
- ✅ Handles errors gracefully
- ✅ Can scale by running multiple workers

**How it works:**
- Polls database every 5 seconds for unprocessed records
- Processes in batches of 50
- Logs progress and errors
- Runs continuously until stopped

**Deployment:**
```bash
# Using PM2 (recommended)
pm2 start npm --name "modsec-worker" -- run worker:modsec
pm2 save
pm2 startup

# Or using systemd
# Create: /etc/systemd/system/modsec-worker.service
```

---

### Option 2: Cron Job

**Best for**: Scheduled batch processing (e.g., every 5 minutes)

```bash
# Run manually
npm run cron:modsec

# Add to crontab (runs every 5 minutes)
*/5 * * * * cd /path/to/modsecurity-back-end && npm run cron:modsec >> /var/log/modsec-processor.log 2>&1
```

**Advantages:**
- ✅ Simple to set up
- ✅ Runs on schedule
- ✅ No long-running process
- ✅ Easy to monitor via logs

**Disadvantages:**
- ❌ Not real-time (processes every X minutes)
- ❌ May miss records if processing takes longer than interval

---

### Option 3: Database Trigger (PostgreSQL)

**Best for**: Immediate processing on insert

Create a PostgreSQL function that processes records automatically:

```sql
-- Create function to process single record
CREATE OR REPLACE FUNCTION process_modsec_landing()
RETURNS TRIGGER AS $$
BEGIN
  -- Process the record asynchronously via NOTIFY
  PERFORM pg_notify('modsec_landing_new', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER modsec_landing_process_trigger
AFTER INSERT ON modsec_landing
FOR EACH ROW
WHEN (NEW.processed = false)
EXECUTE FUNCTION process_modsec_landing();
```

Then have a worker listen to PostgreSQL NOTIFY events.

**Advantages:**
- ✅ Immediate processing
- ✅ No polling overhead
- ✅ Event-driven

**Disadvantages:**
- ❌ More complex setup
- ❌ Requires LISTEN/NOTIFY infrastructure

---

### Option 4: Queue System (Bull/BullMQ)

**Best for**: High-volume, distributed processing

Use a Redis-based queue:

```typescript
import Queue from 'bull';

const modsecQueue = new Queue('modsec-processing', {
  redis: { host: 'localhost', port: 6379 }
});

// Add job when record is inserted
modsecQueue.add('process-record', { landingId: '123' });

// Process jobs
modsecQueue.process('process-record', async (job) => {
  await processModsecLandingRecord(job.data.landingId);
});
```

**Advantages:**
- ✅ Scalable (multiple workers)
- ✅ Job retry logic
- ✅ Job monitoring
- ✅ Priority queues

**Disadvantages:**
- ❌ Requires Redis
- ❌ More complex infrastructure

---

### Option 5: Async API Endpoint (Current + Improvement)

Keep the API but make it async:

```typescript
// Start processing in background, return immediately
router.post("/process", async (req: Request, res: Response) => {
  const { organizationId, batchSize = 100 } = req.body;
  
  // Return immediately
  res.json({ 
    success: true, 
    message: "Processing started",
    jobId: "some-id"
  });
  
  // Process in background (don't await)
  processAllModsecLandingRecords(organizationId, batchSize)
    .then(result => {
      console.log("Background processing completed:", result);
    })
    .catch(error => {
      console.error("Background processing error:", error);
    });
});
```

**Advantages:**
- ✅ Quick API response
- ✅ No changes to infrastructure

**Disadvantages:**
- ❌ No way to track progress
- ❌ Errors might be lost
- ❌ Still uses API server resources

---

## Recommended Setup

### For Development:
Use **Option 1 (Worker Process)** - simple and effective

```bash
npm run worker:modsec
```

### For Production:
Use **Option 1 (Worker Process) with PM2** for reliability:

```bash
# Install PM2
npm install -g pm2

# Start worker
pm2 start npm --name "modsec-worker" -- run worker:modsec

# Save configuration
pm2 save

# Setup auto-start on reboot
pm2 startup
```

### For High-Volume:
Use **Option 4 (Queue System)** with multiple workers

---

## Comparison Table

| Option | Real-time | Scalability | Complexity | Resource Usage |
|--------|-----------|-------------|------------|----------------|
| Worker Process | ✅ Yes | ⚠️ Medium | ⭐ Low | Medium |
| Cron Job | ❌ No | ⚠️ Medium | ⭐ Low | Low |
| DB Trigger | ✅ Yes | ⚠️ Medium | ⭐⭐ Medium | Low |
| Queue System | ✅ Yes | ✅ High | ⭐⭐⭐ High | High |
| Async API | ⚠️ Partial | ❌ Low | ⭐ Low | High |

---

## Quick Start: Worker Process

1. **Start the worker:**
   ```bash
   npm run worker:modsec
   ```

2. **Or with PM2 (production):**
   ```bash
   pm2 start npm --name "modsec-worker" -- run worker:modsec
   pm2 logs modsec-worker  # View logs
   ```

3. **Monitor:**
   - Check logs for processing status
   - Use `/api/modsec/stats` to see progress
   - Worker processes records automatically

The worker will:
- ✅ Process records continuously
- ✅ Handle errors gracefully
- ✅ Log progress
- ✅ Scale by running multiple instances

