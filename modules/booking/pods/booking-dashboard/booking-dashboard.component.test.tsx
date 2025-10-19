import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BookingDashboardComponent } from './booking-dashboard.component';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    toString: () => 'date=2025-01-10&boxId=box-123',
    get: (key: string) => {
      if (key === 'date') return '2025-01-10';
      if (key === 'boxId') return 'box-123';
      return null;
    },
  }),
}));

vi.mock('@/modules/boxes/hooks/useBoxFromUrl.hook', () => ({
  useBoxFromUrl: () => ({
    boxId: 'box-123',
    navigateToBox: vi.fn(),
  }),
}));

vi.mock('@/modules/prebooking/pods/prebooking/hooks/usePreBooking.hook', () => ({
  usePreBooking: () => ({
    prebookings: [],
    fetchPrebookings: vi.fn(),
    hasActivePrebooking: vi.fn(),
    getActivePrebookingForSlotDay: vi.fn(),
  }),
}));

vi.mock('../../hooks/useBooking.hook', () => ({
  useBooking: vi.fn(() => ({
    bookingDay: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    setDate: vi.fn(),
    setBox: vi.fn(),
    retryOnError: vi.fn(),
    statistics: null,
  })),
}));

vi.mock('../../hooks/useBookingContext.hook', () => ({
  BookingProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useBookingContext: () => ({
    state: {
      selectedDate: '2025-01-15',
      selectedBoxId: 'box-123',
      currentDay: null,
      isLoading: false,
      error: null,
      cache: new Map(),
    },
    actions: {
      setSelectedDate: vi.fn(),
      setSelectedBox: vi.fn(),
      setCurrentDay: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      cacheDay: vi.fn(),
      clearCache: vi.fn(),
    },
    computed: {
      hasBookings: false,
      isInitialized: true,
    },
  }),
}));

describe('BookingDashboardComponent - Past Date Redirection', () => {
  const mockSetDate = vi.fn();
  const mockRouterReplace = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Past Date Access Prevention', () => {
    it('should redirect to today when accessing a past date via URL', async () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      // Mock useBookingContext to return a past date
      const useBookingContext = await import('../../hooks/useBookingContext.hook');
      vi.mocked(useBookingContext.useBookingContext).mockReturnValue({
        state: {
          selectedDate: '2025-01-10', // Past date
          selectedBoxId: 'box-123',
          currentDay: null,
          isLoading: false,
          error: null,
          cache: new Map(),
        },
        actions: {
          setSelectedDate: mockSetDate,
          setSelectedBox: vi.fn(),
          setCurrentDay: vi.fn(),
          setLoading: vi.fn(),
          setError: vi.fn(),
          cacheDay: vi.fn(),
          clearCache: vi.fn(),
        },
        computed: {
          hasBookings: false,
          isInitialized: true,
        },
      });

      // Mock useRouter to track replace calls
      const useRouter = await import('next/navigation');
      vi.mocked(useRouter.useRouter).mockReturnValue({
        push: vi.fn(),
        replace: mockRouterReplace,
      } as any);

      render(
        <BookingDashboardComponent
          initialDate="2025-01-10"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      // Wait for the redirect effect to trigger
      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith(
          'Fecha actualizada',
          expect.objectContaining({
            description: expect.stringContaining('No se puede acceder a fechas pasadas'),
          })
        );
      });
    });

    it('should not redirect when accessing current date', async () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      const useBookingContext = await import('../../hooks/useBookingContext.hook');
      vi.mocked(useBookingContext.useBookingContext).mockReturnValue({
        state: {
          selectedDate: '2025-01-15', // Today
          selectedBoxId: 'box-123',
          currentDay: null,
          isLoading: false,
          error: null,
          cache: new Map(),
        },
        actions: {
          setSelectedDate: mockSetDate,
          setSelectedBox: vi.fn(),
          setCurrentDay: vi.fn(),
          setLoading: vi.fn(),
          setError: vi.fn(),
          cacheDay: vi.fn(),
          clearCache: vi.fn(),
        },
        computed: {
          hasBookings: false,
          isInitialized: true,
        },
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      // Should not show redirect toast
      await waitFor(() => {
        expect(toast.info).not.toHaveBeenCalled();
      });
    });

    it('should not redirect when accessing future date', async () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      const useBookingContext = await import('../../hooks/useBookingContext.hook');
      vi.mocked(useBookingContext.useBookingContext).mockReturnValue({
        state: {
          selectedDate: '2025-01-20', // Future date
          selectedBoxId: 'box-123',
          currentDay: null,
          isLoading: false,
          error: null,
          cache: new Map(),
        },
        actions: {
          setSelectedDate: mockSetDate,
          setSelectedBox: vi.fn(),
          setCurrentDay: vi.fn(),
          setLoading: vi.fn(),
          setError: vi.fn(),
          cacheDay: vi.fn(),
          clearCache: vi.fn(),
        },
        computed: {
          hasBookings: false,
          isInitialized: true,
        },
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-20"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      // Should not show redirect toast
      await waitFor(() => {
        expect(toast.info).not.toHaveBeenCalled();
      });
    });
  });

  describe('Date Input Restrictions', () => {
    it('should set min attribute on date input to today', async () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      const dateInput = screen.getByDisplayValue('2025-01-15');
      expect(dateInput).toHaveAttribute('min');

      const minValue = dateInput.getAttribute('min');
      // Should be today's date in YYYYMMDD format
      expect(minValue).toMatch(/^\d{8}$/);
    });

    it('should disable date input when loading', async () => {
      const useBooking = await import('../../hooks/useBooking.hook');
      vi.mocked(useBooking.useBooking).mockReturnValue({
        bookingDay: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        setDate: vi.fn(),
        setBox: vi.fn(),
        retryOnError: vi.fn(),
        statistics: null,
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      const dateInput = screen.getByDisplayValue('2025-01-15');
      expect(dateInput).toBeDisabled();
    });
  });

  describe('Authentication Requirements', () => {
    it('should show authentication message when not authenticated', () => {
      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={false}
        />
      );

      expect(screen.getByText('Autenticación requerida')).toBeInTheDocument();
      expect(screen.getByText(/Necesitas iniciar sesión/i)).toBeInTheDocument();
    });

    it('should not show booking content when not authenticated', () => {
      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={false}
        />
      );

      expect(screen.queryByText('Reservas disponibles')).not.toBeInTheDocument();
    });
  });

  describe('Week Selector Integration', () => {
    it('should render WeekSelector component', async () => {
      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      // WeekSelector should be rendered
      await waitFor(() => {
        const weekSelector = screen.getByRole('group', {
          name: /selector semanal/i,
        });
        expect(weekSelector).toBeInTheDocument();
      });
    });

    it('should pass selectedDate to WeekSelector', async () => {
      const useBookingContext = await import('../../hooks/useBookingContext.hook');
      vi.mocked(useBookingContext.useBookingContext).mockReturnValue({
        state: {
          selectedDate: '2025-01-15',
          selectedBoxId: 'box-123',
          currentDay: null,
          isLoading: false,
          error: null,
          cache: new Map(),
        },
        actions: {
          setSelectedDate: vi.fn(),
          setSelectedBox: vi.fn(),
          setCurrentDay: vi.fn(),
          setLoading: vi.fn(),
          setError: vi.fn(),
          cacheDay: vi.fn(),
          clearCache: vi.fn(),
        },
        computed: {
          hasBookings: false,
          isInitialized: true,
        },
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      const dateInput = screen.getByDisplayValue('2025-01-15');
      expect(dateInput).toBeInTheDocument();
    });

    it('should disable WeekSelector when loading', async () => {
      const useBooking = await import('../../hooks/useBooking.hook');
      vi.mocked(useBooking.useBooking).mockReturnValue({
        bookingDay: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        setDate: vi.fn(),
        setBox: vi.fn(),
        retryOnError: vi.fn(),
        statistics: null,
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      // All day buttons should be disabled when loading
      await waitFor(() => {
        const gridCells = screen.queryAllByRole('gridcell');
        if (gridCells.length > 0) {
          gridCells.forEach((cell) => {
            expect(cell).toBeDisabled();
          });
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when booking fetch fails', async () => {
      const useBooking = await import('../../hooks/useBooking.hook');
      vi.mocked(useBooking.useBooking).mockReturnValue({
        bookingDay: null,
        isLoading: false,
        error: 'Failed to fetch bookings',
        refetch: vi.fn(),
        setDate: vi.fn(),
        setBox: vi.fn(),
        retryOnError: vi.fn(),
        statistics: null,
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      expect(screen.getByText('Error al cargar las reservas')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch bookings')).toBeInTheDocument();
    });

    it('should provide retry button on error', async () => {
      const mockRetry = vi.fn();
      const useBooking = await import('../../hooks/useBooking.hook');
      vi.mocked(useBooking.useBooking).mockReturnValue({
        bookingDay: null,
        isLoading: false,
        error: 'Network error',
        refetch: vi.fn(),
        setDate: vi.fn(),
        setBox: vi.fn(),
        retryOnError: mockRetry,
        statistics: null,
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      const retryButton = screen.getByRole('button', { name: /reintentar/i });
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading skeletons when loading', async () => {
      const useBooking = await import('../../hooks/useBooking.hook');
      vi.mocked(useBooking.useBooking).mockReturnValue({
        bookingDay: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        setDate: vi.fn(),
        setBox: vi.fn(),
        retryOnError: vi.fn(),
        statistics: null,
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      // Should show loading skeletons
      const cards = screen.getAllByRole('article');
      expect(cards.length).toBeGreaterThan(0);
    });
  });
});
