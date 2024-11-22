/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config();
const path = require('path');
const pkg = require('./package.json');

const TRACKER_SCRIPT = '/script.js';

const basePath = process.env.BASE_PATH;
const collectApiEndpoint = process.env.COLLECT_API_ENDPOINT;
const cloudMode = process.env.CLOUD_MODE;
const cloudUrl = process.env.CLOUD_URL;
const defaultLocale = process.env.DEFAULT_LOCALE;
const disableLogin = process.env.DISABLE_LOGIN;
const disableUI = process.env.DISABLE_UI;
const forceSSL = process.env.FORCE_SSL;
const frameAncestors = process.env.ALLOWED_FRAME_URLS;
const privateMode = process.env.PRIVATE_MODE;
const trackerScriptName = process.env.TRACKER_SCRIPT_NAME;
const trackerScriptURL = process.env.TRACKER_SCRIPT_URL;

const contentSecurityPolicy = [
  `default-src 'self'`,
  `img-src * data:`,
  `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://fonts.googleapis.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  `connect-src 'self' api.umami.is cloud.umami.is`,
  `frame-ancestors 'self' ${frameAncestors}`,
];

const defaultHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy
      .join(';')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  },
];

if (forceSSL) {
  defaultHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  });
}

const trackerHeaders = [
  {
    key: 'Access-Control-Allow-Origin',
    value: '*',
  },
  {
    key: 'Cache-Control',
    value: 'public, max-age=86400, must-revalidate',
  },
];

const headers = [
  {
    source: '/:path*',
    headers: defaultHeaders,
  },
  {
    source: TRACKER_SCRIPT,
    headers: trackerHeaders,
  },
];

const rewrites = [];

if (trackerScriptURL) {
  rewrites.push({
    source: TRACKER_SCRIPT,
    destination: trackerScriptURL,
  });
}

if (collectApiEndpoint) {
  rewrites.push({
    source: collectApiEndpoint,
    destination: '/api/send',
  });
}

const redirects = [
  {
    source: '/settings',
    destination: '/settings/websites',
    permanent: true,
  },
  {
    source: '/teams/:id',
    destination: '/teams/:id/dashboard',
    permanent: true,
  },
  {
    source: '/teams/:id/settings',
    destination: '/teams/:id/settings/team',
    permanent: true,
  },
];

// Adding rewrites + headers for all alternative tracker script names.
if (trackerScriptName) {
  const names = trackerScriptName?.split(',').map(name => name.trim());

  if (names) {
    names.forEach(name => {
      const normalizedSource = `/${name.replace(/^\/+/, '')}`;

      rewrites.push({
        source: normalizedSource,
        destination: TRACKER_SCRIPT,
      });

      headers.push({
        source: normalizedSource,
        headers: trackerHeaders,
      });
    });
  }
}

if (cloudMode && cloudUrl) {
  redirects.push({
    source: '/settings/:path*',
    destination: `${cloudUrl}/settings/:path*`,
    permanent: false,
  });

  redirects.push({
    source: '/teams/:id/settings/:path*',
    destination: `${cloudUrl}/teams/:id/settings/:path*`,
    permanent: false,
  });

  if (disableLogin) {
    redirects.push({
      source: '/login',
      destination: cloudUrl,
      permanent: false,
    });
  }
}

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: false,
  env: {
    basePath,
    cloudMode,
    cloudUrl,
    configUrl: '/config',
    currentVersion: pkg.version,
    defaultLocale,
    disableLogin,
    disableUI,
    privateMode,
  },
  basePath,
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack(config) {
    const fileLoaderRule = config.module.rules.find(rule => rule.test?.test?.('.svg'));

    config.module.rules.push(
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/,
      },
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
        use: ['@svgr/webpack'],
      },
    );

    fileLoaderRule.exclude = /\.svg$/i;

    config.resolve.alias['public'] = path.resolve('./public');

    return config;
  },
  async headers() {
    return headers;
  },
  async rewrites() {
    return [
      ...rewrites,
      {
        source: '/telemetry.js',
        destination: '/api/scripts/telemetry',
      },
      {
        source: '/teams/:teamId/:path((?!settings).*)*',
        destination: '/:path*',
      },
    ];
  },
  async redirects() {
    return [...redirects];
  },
};

module.exports = config;
