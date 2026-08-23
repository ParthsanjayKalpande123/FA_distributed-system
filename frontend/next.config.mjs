const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://node-a:3001/api/:path*' },
      // Note: WebSocket proxying handled separately
    ];
  },
};
export default nextConfig;
