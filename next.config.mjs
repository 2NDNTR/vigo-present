/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // pg ships native-ish bits; keep it out of the bundler and require it at runtime
  serverExternalPackages: ['pg'],
};

export default nextConfig;
