import type { NextConfig } from 'next';
import type { Configuration } from 'webpack';

const isProduction = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  //output: isProduction ? 'export' : undefined,
  // basePath: isProduction ? '/sesa0001' : '',
  basePath: '',
  images: {
    unoptimized: true,
    disableStaticImages: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.tenor.com',
        pathname: '/**',
      },
    ],
  },
  webpack(config: Configuration) {
    if (!config.module) {
      config.module = { rules: [] };
    }
    
    if (!config.module.rules) {
      config.module.rules = [];
    }

    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.[jt]sx?$/,
      use: [
        {
          loader: '@svgr/webpack',
          options: {
            svgoConfig: {
              plugins: [
                {
                  name: 'removeViewBox',
                  active: false
                }
              ]
            }
          }
        }
      ]
    });

    return config;
  },
};

export default nextConfig;