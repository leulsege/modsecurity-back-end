# Quick Cron Setup Guide

## ✅ Test First

The cron script is ready! Test it manually:

```bash
cd modsecurity-back-end
npm run cron:modsec
```

---

## 🐧 Linux Server Setup (Recommended)

### Option 1: Simple Cron (Easiest)

1. **SSH into your server** (zergaw-waf)

2. **Edit crontab:**
   ```bash
   crontab -e
   ```

3. **Add this line** (runs every 5 minutes):
   ```cron
   */5 * * * * cd /path/to/modsecurity-back-end && /usr/bin/npm run cron:modsec >> /var/log/modsec-processor.log 2>&1
   ```

4. **Or every 2 minutes** (faster processing):
   ```cron
   */2 * * * * cd /path/to/modsecurity-back-end && /usr/bin/npm run cron:modsec >> /var/log/modsec-processor.log 2>&1
   ```

5. **Save and verify:**
   ```bash
   crontab -l
   ```

6. **Check logs:**
   ```bash
   tail -f /var/log/modsec-processor.log
   ```

---

### Option 2: Systemd Timer (More Reliable)

1. **Create service file** `/etc/systemd/system/modsec-processor.service`:
   ```ini
   [Unit]
   Description=ModSec Landing Processor
   After=network.target

   [Service]
   Type=oneshot
   User=root
   WorkingDirectory=/path/to/modsecurity-back-end
   Environment="NODE_ENV=production"
   EnvironmentFile=/path/to/modsecurity-back-end/.env
   ExecStart=/usr/bin/npm run cron:modsec
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

2. **Create timer file** `/etc/systemd/system/modsec-processor.timer`:
   ```ini
   [Unit]
   Description=Run ModSec Processor every 5 minutes
   Requires=modsec-processor.service

   [Timer]
   OnCalendar=*:0/5
   Persistent=true

   [Install]
   WantedBy=timers.target
   ```

3. **Enable and start:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable modsec-processor.timer
   sudo systemctl start modsec-processor.timer
   ```

4. **Check status:**
   ```bash
   sudo systemctl status modsec-processor.timer
   sudo journalctl -u modsec-processor.service -f
   ```

---

## ⚙️ Configuration

### Environment Variables (`.env` file)

```env
DATABASE_URL=your-database-url
DIRECT_URL=your-direct-url

# Optional
DEFAULT_ORGANIZATION_ID=your-org-id  # If you want to assign logs to a specific org
BATCH_SIZE=100  # Number of records to process per run (default: 100)
```

---

## 📊 Monitoring

### Check Processing Stats

```bash
# Via API (if your server is running)
curl http://localhost:3001/api/modsec/stats

# Or directly in database
psql -c "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE processed = true) as processed, COUNT(*) FILTER (WHERE processed = false) as unprocessed FROM modsec_landing;"
```

### View Logs

**Cron logs:**
```bash
tail -f /var/log/modsec-processor.log
```

**Systemd logs:**
```bash
sudo journalctl -u modsec-processor.service -f
```

---

## ⏰ Cron Schedule Examples

| Schedule | Description |
|----------|-------------|
| `*/2 * * * *` | Every 2 minutes (fast) |
| `*/5 * * * *` | Every 5 minutes (recommended) |
| `*/10 * * * *` | Every 10 minutes |
| `* * * * *` | Every minute (very fast) |

---

## 🚀 Quick Start (Copy & Paste)

**For your Linux server (zergaw-waf):**

```bash
# 1. SSH into server
ssh root@zergaw-waf

# 2. Navigate to project
cd /path/to/modsecurity-back-end

# 3. Test the script
npm run cron:modsec

# 4. Add to crontab (every 5 minutes)
crontab -e
# Add this line:
*/5 * * * * cd /path/to/modsecurity-back-end && /usr/bin/npm run cron:modsec >> /var/log/modsec-processor.log 2>&1

# 5. Verify
crontab -l

# 6. Monitor
tail -f /var/log/modsec-processor.log
```

---

## ✅ That's It!

Your cron job will now:
- ✅ Run automatically every 5 minutes (or your chosen interval)
- ✅ Process all unprocessed `modsec_landing` records
- ✅ Transform them into `Log` table entries
- ✅ Mark records as processed
- ✅ Log everything for monitoring

No more waiting for API responses! 🎉

