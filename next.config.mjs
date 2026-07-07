/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent the client-side Router Cache from serving stale RSC payloads for
  // dynamic routes. Without this, navigating back to the candidates list
  // after a stage change would show the old (pre-change) data because Next.js
  // caches the RSC payload for 5 minutes by default. Setting `dynamic: 0`
  // forces a fresh server fetch on every navigation to a dynamic route,
  // which is the correct behaviour for an ATS where data changes frequently.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 5,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nuanu.com",
      },
      {
        protocol: "https",
        hostname: "www.nuanu.com",
      },
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
      },
    ],
  },
};

export default nextConfig;
