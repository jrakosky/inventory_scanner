/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    // We use SVG logos (brand assets we control). Next/Image refuses SVG by
    // default as an XSS precaution; these flags trust-and-render the SVGs
    // while setting Content-Disposition: attachment + a restrictive CSP so
    // that if a malicious SVG ever does get served, it can't execute
    // scripts in the browsing context.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

module.exports = nextConfig;
