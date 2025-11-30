/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep existing optimizations
  reactStrictMode: true,
  
  // Enable static export for Amplify Hosting
  output: 'export',
  
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
