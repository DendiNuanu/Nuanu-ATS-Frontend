/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ],
  },
};

export default nextConfig;
