export const BOOKING_CONSTANTS = {
  API: {
    BASE_URL: '',
    ENDPOINTS: {
      BOOKINGS: '/api/booking',
    },
    BOX_IDS: {
      CROSSFIT_CERDANYOLA: '10122',
    },
  },

  UI: {
    COLORS: {
      AVAILABLE: '#2BB143',
      BOOKED: '#2563eb',
      FULL: '#6b7280',
      WAITLIST: '#f59e0b',
      DISABLED: '#d1d5db',
    },

    BREAKPOINTS: {
      MOBILE: '640px',
      TABLET: '768px',
      DESKTOP: '1024px',
    },

    GRID_COLUMNS: {
      MOBILE: 1,
      TABLET: 2,
      DESKTOP: 3,
    },

    MIN_TOUCH_TARGET: '44px',
    CARD_MIN_HEIGHT: '120px',
  },

  CACHE: {
    STALE_TIME: 1000 * 60 * 5, // 5 minutes
    CACHE_TIME: 1000 * 60 * 30, // 30 minutes
  },

  DATE_FORMATS: {
    API: 'YYYYMMDD',
    DISPLAY: 'DD MMM YYYY',
    TIME: 'HH:mm',
  },

  BOOKING_STATES: {
    AVAILABLE: 0,
    BOOKED: 1,
  },

  CLASS_TYPES: {
    OPEN_BOX: 'OPEN BOX',
    TEAM_WOD: 'TEAM WOD',
    BARBELL_WOD: 'BARBELL WOD',
    GYMNASTICS: 'GYMNASTICS',
    HALTEROFILIA: 'HALTEROFILIA',
  },
} as const;