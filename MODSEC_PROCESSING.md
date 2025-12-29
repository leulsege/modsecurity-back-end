# ModSec Landing to Log Processing

This document explains how to process data from the `modsec_landing` table and migrate it to the `Log` table.

## Overview

The `modsec_landing` table stores raw ModSecurity transaction JSON data. The processing system:
1. Reads unprocessed records from `modsec_landing`
2. Transforms the JSON data into the structured `Log` format
3. Inserts the categorized data into the `Log` table
4. Marks the original record as processed

## Database Schema

### ModsecLanding Table
- `id`: UUID primary key
- `data`: JSON column containing the raw ModSecurity transaction
- `date`: Timestamp when the record was created
- `processed`: Boolean flag indicating if the record has been processed
- `createdAt`: Record creation timestamp

### Data Transformation

The processor maps ModSecurity transaction fields to Log table fields:

| ModSecurity Field | Log Field | Notes |
|------------------|-----------|-------|
| `transaction.client_ip` | `clientIp` | Required |
| `transaction.client_port` | `clientPort` | Optional |
| `transaction.time_stamp` | `timestamp` | Parsed to DateTime |
| `transaction.request.hostname` | `host` | Falls back to Host header |
| `transaction.request.method` | `method` | HTTP method (GET, POST, etc.) |
| `transaction.request.uri` | `requestUrl` | Request URI |
| `transaction.request.headers` | `headers` | Full headers object |
| `transaction.request.headers.User-Agent` | `userAgent` | Extracted from headers |
| `transaction.request.http_version` | `httpMethod` | HTTP version (1.1, 2, etc.) |
| `transaction.response.http_code` | `responseCode` | HTTP response code |
| `transaction.response.headers` | `responseHeader` | Response headers object |
| `transaction.messages[0].message` | `message` | First message text |
| `transaction.messages[0].details.ruleId` | `ruleId` | Rule ID from first message |
| `transaction.messages[0].details.severity` | `severity` | Mapped to CRITICAL/HIGH/MEDIUM/LOW |
| `transaction.messages[0].details.maturity` | `maturity` | Maturity score |

### Action Determination

The `action` field is determined based on:
- Response code 403 or 406 → `"blocked"`
- Severity >= 6 → `"blocked"`
- Otherwise → `"warning"`

### Severity Mapping

Severity numbers are mapped to levels:
- 8+ → `"CRITICAL"`
- 6-7 → `"HIGH"`
- 4-5 → `"MEDIUM"`
- <4 → `"LOW"`

## Usage

### Option 1: Using the Script

Process all unprocessed records:

```bash
npm run process:modsec
```

Process with an organization ID:

```bash
npm run process:modsec <organization-id>
```

Or directly with tsx:

```bash
npx tsx src/scripts/processModsecLanding.ts [organizationId]
```

### Option 2: Using the API Endpoint

Start the server and use the API:

```bash
npm run dev
```

#### Process All Records

```bash
POST /api/modsec/process
Content-Type: application/json

{
  "organizationId": "optional-org-id",
  "batchSize": 100
}
```

#### Process Single Record

```bash
POST /api/modsec/process/:id
Content-Type: application/json

{
  "organizationId": "optional-org-id"
}
```

#### Get Statistics

```bash
GET /api/modsec/stats
```

#### List Landing Records

```bash
GET /api/modsec/landing?processed=false&limit=100&offset=0
```

## Example JSON Structure

The `modsec_landing.data` column should contain JSON like:

```json
{
  "transaction": {
    "client_ip": "185.16.39.146",
    "time_stamp": "Wed Dec 24 04:41:16 2025",
    "client_port": 34006,
    "request": {
      "method": "GET",
      "http_version": "1.1",
      "hostname": "196.188.250.141",
      "uri": "/",
      "headers": {
        "User-Agent": "Mozilla/5.0",
        "Host": "196.188.250.141:80"
      }
    },
    "response": {
      "http_code": 200,
      "headers": {
        "Server": "nginx/1.24.0",
        "Content-Type": "text/html"
      }
    },
    "messages": [
      {
        "message": "Host header is a numeric IP address",
        "details": {
          "ruleId": "920350",
          "severity": "4",
          "maturity": "0"
        }
      }
    ]
  }
}
```

## Migration Steps

1. **Create the migration** (if not already done):
   ```bash
   npm run prisma:migrate
   ```

2. **Ensure data exists** in `modsec_landing` table with JSON in the `data` column

3. **Run the processor**:
   ```bash
   npm run process:modsec
   ```

4. **Verify results**:
   - Check the `Log` table for new entries
   - Check `modsec_landing.processed` flags
   - Review any errors in the output

## Error Handling

The processor handles:
- Invalid JSON data
- Missing required fields (uses defaults)
- Date parsing errors (falls back to current date)
- Database connection issues

Failed records are logged with their IDs and error messages, allowing for manual review and reprocessing.

## Batch Processing

Records are processed in batches (default: 100) to:
- Avoid memory issues with large datasets
- Provide progress feedback
- Allow for graceful error handling

You can adjust the batch size via the API or by modifying the script.


