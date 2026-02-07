# WAF Agent Integration Setup

This guide explains how to configure the backend to communicate with the WAF agent.

## How Communication Works

The communication matches `test_toggle.sh` exactly:

- **Backend** has the **PRIVATE key** (to sign requests)
- **Agent** has the **PUBLIC key** (to verify signatures)
- Data format: `domain|enabled` where enabled is lowercase "true" or "false"
- Uses RSA PSS padding with SHA256

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# WAF Agent Configuration
# URL of the WAF agent service (e.g., http://196.188.250.141:8080)
WAF_AGENT_URL="http://196.188.250.141:8080"

# Private key content (PEM format) - paste the entire key here
# This is the PRIVATE key that matches the PUBLIC key on the agent server
# You can get this from /etc/waf-agent/private_key.pem on the WAF agent server
WAF_AGENT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
(paste the entire key content here, including BEGIN/END lines)
-----END PRIVATE KEY-----"

# Authentication token for the WAF agent (optional, defaults to "test-token")
WAF_AGENT_AUTH_TOKEN="test-token"
```

## Setting Up the Private Key

1. **Get the private key from the WAF agent server:**

   ```bash
   # On the WAF agent server (196.188.250.141)
   cat /etc/waf-agent/private_key.pem
   ```

2. **Copy the entire key content (including BEGIN/END lines) and paste it in your `.env` file:**

   ```env
   WAF_AGENT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
   MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
   (paste all lines here)
   -----END PRIVATE KEY-----"
   ```

   **Important:**

   - Keep the quotes around the key
   - Include the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
   - You can use multi-line format or single-line (the service handles both)

## How It Works

1. When a user toggles WAF status for a domain via the API:

   - The backend first calls the WAF agent at `WAF_AGENT_URL/waf/toggle`
   - The request is signed using the private key
   - The agent verifies the signature and updates the nginx configuration
   - Only if the agent returns success, the backend updates the database

2. **Security:**
   - All requests to the agent are signed with RSA signatures
   - The agent verifies signatures using the corresponding public key
   - This ensures only authorized requests can modify nginx configurations

## Testing

After setting up, test the integration:

1. Make sure the WAF agent is running and accessible
2. Try toggling WAF status for a domain via the API
3. Check the backend logs to see if the agent call was successful
4. Verify the nginx configuration was updated on the WAF server

## Troubleshooting

- **"Private key not loaded"**: Check that `WAF_AGENT_PRIVATE_KEY_PATH` points to a valid file and the backend has read permissions
- **"WAF agent returned non-OK status"**: Check the agent logs on the WAF server
- **Connection errors**: Verify `WAF_AGENT_URL` is correct and the agent is accessible from the backend server
