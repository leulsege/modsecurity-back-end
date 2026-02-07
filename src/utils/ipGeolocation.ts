import { PRIVATE_IP_RANGES, LOCALHOST_IPS } from "../constants/ipRanges";

export interface IPLocation {
  country: string;
  lat: number;
  lng: number;
}

// Cache to avoid hitting API rate limits
const locationCache = new Map<string, IPLocation>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours cache

interface CacheEntry {
  location: IPLocation;
  timestamp: number;
}

/**
 * Check if an IP address is a private/local IP address
 */
export function isPrivateIP(ip: string): boolean {
  // Check for localhost IPs
  if (LOCALHOST_IPS.includes(ip as any)) {
    return true;
  }

  // Check for private IP ranges
  if (ip.startsWith(PRIVATE_IP_RANGES.PRIVATE_CLASS_C)) {
    return true;
  }

  if (ip.startsWith(PRIVATE_IP_RANGES.PRIVATE_CLASS_A)) {
    return true;
  }

  // Check for private Class B range (172.16.0.0/12)
  for (const prefix of PRIVATE_IP_RANGES.PRIVATE_CLASS_B) {
    if (ip.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Get country and coordinates from IP address using ip-api.com (free API)
 * Returns location information including country name, latitude, and longitude
 * 
 * Free tier: 45 requests/minute, no API key required
 */
export async function getLocationFromIP(ip: string): Promise<IPLocation> {
  // Handle private/local IPs
  if (isPrivateIP(ip)) {
    return { country: "Local", lat: 0, lng: 0 };
  }

  // Check cache first
  const cached = locationCache.get(ip) as CacheEntry | undefined;
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.location;
  }

  try {
    // Use ip-api.com free API (no API key required)
    // Format: http://ip-api.com/json/{ip}?fields=status,message,country,lat,lon
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,lat,lon`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        // Add timeout to avoid hanging
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();

    // Check if API returned an error
    if (data.status === "fail") {
      console.warn(`[IP Geolocation] API error for IP ${ip}: ${data.message}`);
      const fallback: IPLocation = { country: "Unknown", lat: 20, lng: 0 };
      // Cache the fallback to avoid repeated failed requests
      locationCache.set(ip, { location: fallback, timestamp: Date.now() } as CacheEntry);
      return fallback;
    }

    // Extract country name and coordinates
    const country = data.country || "Unknown";
    const lat = data.lat || 20;
    const lng = data.lon || 0; // Note: API returns "lon" not "lng"

    const location: IPLocation = {
      country: country,
      lat: lat,
      lng: lng,
    };

    // Cache the result
    locationCache.set(ip, { location, timestamp: Date.now() } as CacheEntry);

    return location;
  } catch (error) {
    console.error(`[IP Geolocation] Error fetching location for IP ${ip}:`, error);
    // Return fallback location
    const fallback: IPLocation = { country: "Unknown", lat: 20, lng: 0 };
    // Cache the fallback to avoid repeated failed requests
    locationCache.set(ip, { location: fallback, timestamp: Date.now() } as CacheEntry);
    return fallback;
  }
}

/**
 * Batch get locations for multiple IPs (with rate limiting)
 * Processes IPs in batches to respect API rate limits (45 requests/minute)
 */
export async function getLocationsFromIPs(ips: string[]): Promise<Map<string, IPLocation>> {
  const results = new Map<string, IPLocation>();
  const uniqueIPs = Array.from(new Set(ips)); // Remove duplicates
  const uncachedIPs: string[] = [];

  // Check cache for all IPs first
  for (const ip of uniqueIPs) {
    if (isPrivateIP(ip)) {
      results.set(ip, { country: "Local", lat: 0, lng: 0 });
      continue;
    }

    const cached = locationCache.get(ip) as CacheEntry | undefined;
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      results.set(ip, cached.location);
    } else {
      uncachedIPs.push(ip);
    }
  }

  // Process uncached IPs in batches (40 at a time to stay under 45/min limit)
  const batchSize = 40;
  for (let i = 0; i < uncachedIPs.length; i += batchSize) {
    const batch = uncachedIPs.slice(i, i + batchSize);
    
    // Process batch with small delay between requests to respect rate limit
    const batchPromises = batch.map(async (ip, index) => {
      // Add small delay to avoid hitting rate limit
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
      }
      const location = await getLocationFromIP(ip);
      results.set(ip, location);
    });

    await Promise.all(batchPromises);

    // Add delay between batches
    if (i + batchSize < uncachedIPs.length) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batches
    }
  }

  return results;
}
