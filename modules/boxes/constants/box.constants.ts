export const BOX_CONSTANTS = {
  AIMHARDER: {
    BASE_URL: 'https://aimharder.com',
    HOME_PATH: '/home',
    SCHEDULE_PATH: '/schedule?cl',
  },
  PATTERNS: {
    BOX_ID: /box:\s*(\d+)/,
    SUBDOMAIN: /https:\/\/([^.]+)\.aimharder\.com/,
    BOX_LINK: /href="https:\/\/([^.]+)\.aimharder\.com"/g,
  },
  SELECTORS: {
    BOX_NAME: '.box-name, h1, .title',
    PHONE: 'a[href^="tel:"]',
    EMAIL: 'a[href^="mailto:"]',
    ADDRESS: '.address, .location',
    WEBSITE: 'a[href^="http"]:not([href*="aimharder.com"])',
    LOGO: 'img.logo, .box-logo img, header img',
  },
} as const;
