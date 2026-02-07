/**
 * Private/local IP address ranges
 * These are reserved IP address ranges that are not routable on the public internet
 */

/**
 * Private IP address ranges (RFC 1918)
 */
export const PRIVATE_IP_RANGES = {
  // 192.168.0.0/16 - Private network
  PRIVATE_CLASS_C: "192.168.",
  // 10.0.0.0/8 - Private network
  PRIVATE_CLASS_A: "10.",
  // 172.16.0.0/12 - Private network (172.16.0.0 to 172.31.255.255)
  PRIVATE_CLASS_B: [
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
    "172.23.",
    "172.24.",
    "172.25.",
    "172.26.",
    "172.27.",
    "172.28.",
    "172.29.",
    "172.30.",
    "172.31.",
  ],
} as const;

/**
 * Localhost IP addresses
 */
export const LOCALHOST_IPS = ["127.0.0.1", "::1", "localhost"] as const;









