# Cron Job Setup for ModSec Landing Processing

## Quick Setup

### Step 1: Test the Script Manually

```bash
cd modsecurity-back-end
npm run cron:modsec
```

This will process all unprocessed records. Verify it works correctly.

---

### Step 2: Set Up Cron Job

#### Option A: Using crontab (Linux/Mac)

1. **Open crontab editor:**
   ```bash
   crontab -e
   ```

2. **Add this line** (processes every 5 minutes):
   ```cron
   */5 * * * * cd /path/to/modsecurity-back-end && npm run cron:modsec >> /var/log/modsec-processor.log 2>&1
   ```

3. **Or process every minute** (for faster processing):
   ```cron
   * * * * * cd /path/to/modsecurity-back-end && npm run cron:modsec >> /var/log/modsec-processor.log 2>&1
   ```

4. **Save and exit**

5. **Verify cron is running:**
   ```bash
   crontab -l
   ```

6. **Check logs:**
   ```bash
   tail -f /var/log/modsec-processor.log
   ```

---

#### Option B: Using systemd Timer (Linux - Recommended)

**More reliable than cron, better logging, easier to manage**

1. **Create service file** `/etc/systemd/system/modsec-processor.service`:
   ```ini
   [Unit]
   Description=ModSec Landing Processor
   After=network.target

   [Service]
   Type=oneshot
   User=your-user
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
   sudo systemctl status modsec-processor.service
   ```

5. **View logs:**
   ```bash
   sudo journalctl -u modsec-processor.service -f
   ```

---

### Step 3: Configure Environment Variables

Make sure your `.env` file has:
```env
DATABASE_URL=your-database-url
DIRECT_URL=your-direct-url
DEFAULT_ORGANIZATION_ID=optional-org-id  # Optional
BATCH_SIZE=100  # Optional, default is 100
```

---

## Cron Schedule Examples

| Schedule | Description |
|----------|-------------|
| `*/5 * * * *` | Every 5 minutes |
| `* * * * *` | Every minute |
| `*/10 * * * *` | Every 10 minutes |
| `0 * * * *` | Every hour |
| `*/2 * * * *` | Every 2 minutes |

---

## Monitoring

### Check Processing Stats

```bash
# Via API
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

## Troubleshooting

### Cron not running?

1. **Check cron service:**
   ```bash
   sudo systemctl status cron  # Linux
   sudo launchctl list | grep cron  # Mac
   ```

2. **Check cron logs:**
   ```bash
   # Linux
   sudo tail -f /var/log/syslog | grep CRON
   
   # Mac
   log show --predicate 'process == "cron"' --last 1h
   ```

3. **Verify path:**
   - Make sure the path in cron is absolute
   - Make sure `npm` is in PATH or use full path: `/usr/bin/npm`

### Script not finding modules?

Add to cron:
```cron
*/5 * * * * cd /path/to/modsecurity-back-end && /usr/bin/npm run cron:modsec >> /var/log/modsec-processor.log 2>&1
```

Or set PATH in cron:
```cron
PATH=/usr/local/bin:/usr/bin:/bin
*/5 * * * * cd /path/to/modsecurity-back-end && npm run cron:modsec >> /var/log/modsec-processor.log 2>&1
```

---

## Recommended Setup

**For Production:**
- Use **systemd timer** (more reliable)
- Run every **2-5 minutes**
- Set `BATCH_SIZE=50` for consistent processing
- Monitor via logs and `/api/modsec/stats`

**For Development:**
- Use **cron** (simpler)
- Run every **5 minutes**
- Check logs manually

---

## Performance Tips

1. **Adjust batch size** based on your volume:
   - Low volume: `BATCH_SIZE=100`
   - High volume: `BATCH_SIZE=50` (more frequent, smaller batches)

2. **Adjust frequency** based on urgency:
   - Real-time needed: Every 1-2 minutes
   - Normal: Every 5 minutes
   - Low priority: Every 10-15 minutes

3. **Monitor processing time:**
   - If processing takes longer than cron interval, increase interval or decrease batch size

