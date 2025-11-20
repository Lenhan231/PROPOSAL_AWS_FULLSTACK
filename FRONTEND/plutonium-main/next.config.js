/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep existing optimizations
  reactStrictMode: true,
  
  // Allow images from S3 and external sources
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
    ],
  },
  
  // Disable static optimization for pages that use AuthContext
  experimental: {
    runtime: 'nodejs',
  },
};

module.exports = nextConfig;
