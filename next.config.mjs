/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // zero type errors since 27 Oct: a type error now fails the build instead of shipping
  typescript: { ignoreBuildErrors: false },
  // pg ships native-ish bits; keep it out of the bundler and require it at runtime
  serverExternalPackages: ['pg'],
};

export default nextConfig;
