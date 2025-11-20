/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static export to support client-side features like AuthContext
  output: 'standalone',
  
  // Keep existing optimizations
  reactStrictMode: true,
  swcMinify: true,
  
  // Allow images from S3 and external sources
  images: {
    domains: ['onlinelibrary-dev-storage-s3bucket07682993-iyl5cqgqae9t.s3.amazonaws.com'],
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
};

module.exports = nextConfig;
