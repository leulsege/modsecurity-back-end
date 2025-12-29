# Backend Cron Job Setup

The ModSec processing cron job is now integrated directly into your backend server! 🎉

## ✅ What's Done

- ✅ `node-cron` installed and configured
- ✅ Cron scheduler service created
- ✅ Integrated into server startup
- ✅ API endpoint to check cron status
- ✅ Graceful shutdown handling

---

## 🚀 How It Works

When you start your backend server, the cron job automatically starts and processes `modsec_landing` records on a schedule.

---

## ⚙️ Configuration

Add these environment variables to your `.env` file:

```env
# Enable/disable cron (default: enabled)
ENABLE_MODSEC_CRON=true

# Cron schedule (default: every 5 minutes)
# Format: minute hour day month weekday
MODSEC_CRON_SCHEDULE=*/5 * * * *

# Optional: Default organization ID for logs
DEFAULT_ORGANIZATION_ID=your-org-id

# Optional: Batch size (default: 100)
BATCH_SIZE=100
```

---

## 📅 Cron Schedule Examples

| Schedule | Description |
|----------|-------------|
| `*/2 * * * *` | Every 2 minutes |
| `*/5 * * * *` | Every 5 minutes (default) |
| `*/10 * * * *` | Every 10 minutes |
| `* * * * *` | Every minute |
| `0 * * * *` | Every hour |
| `0 */6 * * *` | Every 6 hours |

**Cron format:** `minute hour day month weekday`

---

## 🎯 Usage

### 1. Start Your Server

```bash
npm run dev
# or
npm start
```

You'll see:
```
🚀 Server is running on http://localhost:3001
📚 API Documentation available at http://localhost:3001/docs
⏰ Starting ModSec cron scheduler with schedule: */5 * * * *
✅ ModSec cron scheduler started successfully
```

### 2. Check Cron Status

```bash
# Via API
curl http://localhost:3001/api/modsec/stats
```

Response includes cron status:
```json
{
  "total": 100,
  "processed": 85,
  "unprocessed": 15,
  "processingRate": "85.00",
  "cron": {
    "enabled": true,
    "schedule": "*/5 * * * *",
    "running": true,
    "isProcessing": false
  }
}
```

### 3. Monitor Logs

The cron job logs to your server console:
```
🕐 [2025-12-29T03:13:11.926Z] Starting ModSec processing cron job...
   Organization ID: None
   Batch size: 100
   📊 Found 12 unprocessed records
   ✅ Successfully processed: 12
   ❌ Failed: 0
   ⏱️  Duration: 25000ms
✅ [2025-12-29T03:13:37.926Z] Cron job completed
```

---

## 🔧 Disable/Enable Cron

### Disable Cron

Set in `.env`:
```env
ENABLE_MODSEC_CRON=false
```

Or remove the variable (defaults to enabled).

### Change Schedule

Set in `.env`:
```env
MODSEC_CRON_SCHEDULE=*/2 * * * *  # Every 2 minutes
```

---

## 📊 Features

- ✅ **Automatic Processing**: Runs automatically when server starts
- ✅ **Configurable Schedule**: Change via environment variable
- ✅ **Batch Processing**: Processes records in batches (configurable)
- ✅ **Error Handling**: Continues processing even if some records fail
- ✅ **Prevents Overlap**: Won't start new run if previous is still running
- ✅ **Graceful Shutdown**: Stops cleanly on server shutdown
- ✅ **Status Monitoring**: Check status via API

---

## 🆚 Backend Cron vs Linux Cron

### Backend Cron (Current Setup) ✅
- ✅ No server access needed
- ✅ Easy to configure (just `.env`)
- ✅ Runs with your app
- ✅ Easy to monitor via API
- ✅ Stops when server stops

### Linux Cron
- Requires server access
- Need to edit crontab
- Runs independently
- Harder to monitor
- Keeps running if app crashes

**Recommendation**: Use backend cron (current setup) for simplicity! 🎯

---

## 🐛 Troubleshooting

### Cron Not Running?

1. **Check if enabled:**
   ```bash
   # Should be true or undefined
   echo $ENABLE_MODSEC_CRON
   ```

2. **Check server logs:**
   Look for: `⏰ Starting ModSec cron scheduler...`

3. **Check API status:**
   ```bash
   curl http://localhost:3001/api/modsec/stats
   ```

### Invalid Schedule?

The cron schedule must be valid. Test it at: https://crontab.guru/

### Processing Not Working?

1. Check database connection
2. Check if there are unprocessed records:
   ```bash
   curl http://localhost:3001/api/modsec/stats
   ```
3. Check server logs for errors

---

## ✅ That's It!

Your cron job is now running automatically in the backend! No need to set up Linux cron. Just start your server and it will process logs on schedule. 🎉

