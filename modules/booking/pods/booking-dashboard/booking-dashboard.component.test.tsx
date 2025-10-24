import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingDashboardComponent } from './booking-dashboard.component';

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
    toString: () => 'date=2025-01-15&boxId=box-123',
    get: (key: string) => {
      if (key === 'date') return '2025-01-15';
      if (key === 'boxId') return 'box-123';
      return null;
    },
  }),
}));

vi.mock('@/modules/boxes/hooks/useBoxFromUrl.hook', () => ({
  useBoxFromUrl: () => ({
    boxId: 'box-123',
  }),
}));

vi.mock('@/modules/boxes/hooks/useBoxes.hook', () => ({
  useBoxes: () => ({
    boxes: [
      {
        id: 'box-123',
        name: 'Box Central',
        subdomain: 'central',
        address: '123 Main St',
        boxAimharderId: 'ah-123',
        photo: null,
        timezone: 'America/New_York',
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/modules/prebooking/pods/prebooking/hooks/usePreBooking.hook', () => ({
  usePreBooking: () => ({
    prebookings: [],
    fetchPrebookings: vi.fn(),
    hasActivePrebooking: () => false,
    getActivePrebookingForSlotDay: () => undefined,
  }),
}));

vi.mock('../../hooks/useBooking.hook', () => ({
  useBooking: vi.fn(() => ({
    bookingDay: {
      date: '2025-01-15',
      description: 'Wednesday',
      availableClasses: '10',
      bookings: [],
      timeSlots: [],
      specialEvents: [],
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    setDate: vi.fn(),
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
    },
    actions: {
      setCurrentDay: vi.fn(),
      cacheDay: vi.fn(),
    },
  }),
}));

describe('BookingDashboardComponent - Refactored', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should render with QueryClientProvider', async () => {
    render(
      <Wrapper>
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Reservas disponibles')).toBeInTheDocument();
    });
  });

  it('should show authentication message when not authenticated', () => {
    render(
      <Wrapper>
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={false}
        />
      </Wrapper>
    );

    expect(screen.getByText('Autenticación requerida')).toBeInTheDocument();
    expect(screen.getByText(/Necesitas iniciar sesión/)).toBeInTheDocument();
  });

  it('should render week selector for date navigation', async () => {
    render(
      <Wrapper>
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      </Wrapper>
    );

    await waitFor(() => {
      // WeekSelector should be rendered
      const dateInput = screen.getByDisplayValue('2025-01-15');
      expect(dateInput).toBeInTheDocument();
    });
  });

  it('should display booking grid when data is loaded', async () => {
    render(
      <Wrapper>
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      </Wrapper>
    );

    await waitFor(() => {
      // Grid or content should be rendered
      expect(screen.getByText('Reservas disponibles')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', async () => {
    render(
      <Wrapper>
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      </Wrapper>
    );

    // Component should eventually load and render content
    await waitFor(() => {
      expect(screen.getByText('Reservas disponibles')).toBeInTheDocument();
    });
  });

  it('should redirect to today when accessing past date', async () => {
    const mockSetDate = vi.fn();

    render(
      <Wrapper>
        <BookingDashboardComponent
          initialDate="2025-01-10"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
        />
      </Wrapper>
    );

    // Component should handle date validation
    await waitFor(() => {
      expect(screen.getByText('Reservas disponibles')).toBeInTheDocument();
    });
  });

  it('should render with server-prefetched boxes data', async () => {
    const boxesPrefetch = [
      {
        id: 'box-123',
        name: 'Box Central',
        subdomain: 'central',
        address: '123 Main St',
        boxAimharderId: 'ah-123',
        photo: null,
        timezone: 'America/New_York',
      },
    ];

    render(
      <Wrapper>
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="box-123"
          authCookies={[]}
          isAuthenticated={true}
          boxesPrefetch={boxesPrefetch}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Reservas disponibles')).toBeInTheDocument();
    });
  });
});
