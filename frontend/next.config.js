const path = require('path');
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_INTERNAL_ORIGIN ?? 'http://127.0.0.1:8001'}/:path*`,
      },
    ];
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = withNextIntl(nextConfig);
