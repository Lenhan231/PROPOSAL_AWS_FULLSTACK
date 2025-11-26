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
};

module.exports = nextConfig;
