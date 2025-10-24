import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookingHeader } from './booking-header.component';

describe('BookingHeader', () => {
  it('should render box name when provided', () => {
    const selectedBox = {
      id: 'box-123',
      name: 'Box Central',
      subdomain: 'central',
      address: '123 Main St',
      boxAimharderId: 'ah-123',
      photo: null,
      timezone: 'America/New_York',
    };

    render(
      <BookingHeader
        selectedBox={selectedBox}
        bookingDay={undefined}
        isLoading={false}
      />
    );

    expect(screen.getByText('Box Central')).toBeInTheDocument();
    expect(screen.getByText('central.aimharder.com')).toBeInTheDocument();
  });

  it('should render "Reservas" when no box is provided', () => {
    render(
      <BookingHeader
        selectedBox={undefined}
        bookingDay={undefined}
        isLoading={false}
      />
    );

    expect(screen.getByText('Reservas')).toBeInTheDocument();
  });

  it('should display number of available classes', () => {
    const selectedBox = {
      id: 'box-123',
      name: 'Box Central',
      subdomain: 'central',
      address: '123 Main St',
      boxAimharderId: 'ah-123',
      photo: null,
      timezone: 'America/New_York',
    };

    const bookingDay = {
      date: '2025-01-15',
      description: 'Wednesday',
      availableClasses: '10',
      bookings: [
        {
          id: 1,
          timeSlot: {
            id: 'ts-1',
            time: '06:00',
            startTime: '06:00',
            endTime: '07:00',
          },
          class: {
            id: 1,
            name: 'CrossFit',
            description: 'High intensity',
            color: '#ff0000',
            duration: 60,
            isOnline: false,
          },
          box: { id: 'box-123', name: 'Box Central', address: '123 Main St', image: null },
          coach: { name: 'John', avatar: null },
          status: 'available' as const,
          capacity: {
            limitString: '20',
            current: 10,
            limit: 20,
            available: 10,
            percentage: 50,
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

    render(
      <BookingHeader
        selectedBox={selectedBox}
        bookingDay={bookingDay}
        isLoading={false}
      />
    );

    expect(screen.getByText('1 clases disponibles')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(
      <BookingHeader
        selectedBox={undefined}
        bookingDay={undefined}
        isLoading={true}
      />
    );

    expect(screen.getByText('Cargando datos...')).toBeInTheDocument();
  });

  it('should display error message when error prop is provided', () => {
    render(
      <BookingHeader
        selectedBox={undefined}
        bookingDay={undefined}
        isLoading={false}
        error="Failed to load bookings"
      />
    );

    expect(screen.getByText('Failed to load bookings')).toBeInTheDocument();
  });
});
