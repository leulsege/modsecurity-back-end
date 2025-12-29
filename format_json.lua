-- Lua script to format ModSecurity log for PostgreSQL JSONB column
-- Save this to: /etc/fluent-bit/scripts/format_json.lua

function format_json(tag, timestamp, record)
    -- Get the raw log line
    local raw_data = record["raw_data"]
    
    if raw_data == nil then
        return 0, timestamp, record
    end
    
    -- Try to parse as JSON
    local json = require("json")
    local ok, parsed = pcall(json.decode, raw_data)
    
    if ok and parsed ~= nil then
        -- If it's valid JSON, store the parsed object
        record["data"] = parsed
    else
        -- If parsing fails, store as string wrapped in JSON
        record["data"] = raw_data
    end
    
    -- Remove the raw_data field
    record["raw_data"] = nil
    
    -- Ensure processed is false
    record["processed"] = false
    
    return 1, timestamp, record
end

