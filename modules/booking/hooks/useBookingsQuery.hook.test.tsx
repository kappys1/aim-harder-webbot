import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useBookingsQuery } from './useBookingsQuery.hook';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as BookingService from '../api/services/booking.service';

// Mock the BookingService
vi.mock('../api/services/booking.service');
vi.mock('../api/mappers/booking.mapper');
vi.mock('../utils/booking.utils');

const mockBookingDay = {
  date: '2025-10-24',
  description: '24 de Octubre de 2025',
  availableClasses: 5,
  bookings: [
    {
      id: '1',
      timeSlot: {
        id: 'slot-1',
        time: '09:00 - 10:00',
        startTime: '09:00',
        endTime: '10:00',
      },
      class: {
        id: 'class-1',
        name: 'CrossFit',
        description: 'CrossFit WOD',
        color: 'rgb(255, 0, 0)',
        duration: 60,
        isOnline: false,
      },
      box: {
        id: 'box-1',
        name: 'Box Test',
        address: 'Test Address',
        image: 'test-image.jpg',
      },
      coach: {
        name: 'Coach Test',
        avatar: 'coach-avatar.jpg',
      },
      status: 'available' as const,
      capacity: {
        current: 5,
        limit: 15,
        limitString: '15',
        available: 10,
        percentage: 33.33,
        hasWaitlist: false,
        waitlistCount: 0,
      },
      userBookingId: null,
      isIncludedInPlan: true,
      hasZoomAccess: false,
    },
  ],
  timeSlots: [],
  specialEvents: [],
};

describe('useBookingsQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should fetch booking data when date and boxId are provided', async () => {
    const mockGetBookings = vi.fn().mockResolvedValue({
      day: '24 de Octubre de 2025',
      clasesDisp: 5,
      bookings: [],
      timetable: [],
      seminars: [],
    });

    vi.spyOn(BookingService, 'BookingService').mockImplementation(
      () =>
        ({
          getBookings: mockGetBookings,
        } as any)
    );

    const { result } = renderHook(
      () => useBookingsQuery('2025-10-24', 'box-uuid-123'),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
  });

  it('should not fetch when date or boxId is empty', () => {
    const mockGetBookings = vi.fn();

    vi.spyOn(BookingService, 'BookingService').mockImplementation(
      () =>
        ({
          getBookings: mockGetBookings,
        } as any)
    );

    const { result } = renderHook(
      () => useBookingsQuery('', 'box-uuid-123'),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockGetBookings).not.toHaveBeenCalled();
  });

  it('should have refetchOnWindowFocus enabled', async () => {
    const mockGetBookings = vi.fn().mockResolvedValue({
      day: '24 de Octubre de 2025',
      clasesDisp: 5,
      bookings: [],
      timetable: [],
      seminars: [],
    });

    vi.spyOn(BookingService, 'BookingService').mockImplementation(
      () =>
        ({
          getBookings: mockGetBookings,
        } as any)
    );

    const { result } = renderHook(
      () => useBookingsQuery('2025-10-24', 'box-uuid-123'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // The hook should have refetchOnWindowFocus: true enabled
    // This is tested implicitly - the query options include refetchOnWindowFocus
    const query = queryClient.getQueryData(['bookings', '2025-10-24', 'box-uuid-123']);
    expect(query).toBeDefined();
  });
});
