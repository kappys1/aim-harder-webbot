import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookingCardDisplay } from './booking-card-display.component';
import { Booking } from '@/modules/booking/models/booking.model';

describe('BookingCardDisplay', () => {
  const mockBooking: Booking = {
    id: 1,
    timeSlot: {
      id: 'ts-1',
      time: '06:00',
      startTime: '06:00',
      endTime: '07:00',
    },
    class: {
      id: 1,
      name: 'CrossFit Fundamentals',
      description: 'High intensity training',
      color: '#ff0000',
      duration: 60,
      isOnline: false,
    },
    box: {
      id: 'box-123',
      name: 'Box Central',
      address: '123 Main St',
      image: null,
    },
    coach: {
      name: 'John Doe',
      avatar: null,
    },
    status: 'available',
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
  };

  it('should render booking class name', () => {
    render(<BookingCardDisplay booking={mockBooking} />);

    expect(screen.getByText('CrossFit Fundamentals')).toBeInTheDocument();
  });

  it('should render booking class description', () => {
    render(<BookingCardDisplay booking={mockBooking} />);

    expect(screen.getByText('High intensity training')).toBeInTheDocument();
  });

  it('should render booking time', () => {
    render(<BookingCardDisplay booking={mockBooking} />);

    expect(screen.getByText('Hora')).toBeInTheDocument();
    expect(screen.getByText('06:00 - 07:00')).toBeInTheDocument();
  });

  it('should render booking location (box name)', () => {
    render(<BookingCardDisplay booking={mockBooking} />);

    expect(screen.getByText('Ubicación')).toBeInTheDocument();
    expect(screen.getByText('Box Central')).toBeInTheDocument();
  });

  it('should render capacity information', () => {
    render(<BookingCardDisplay booking={mockBooking} />);

    expect(screen.getByText('Capacidad')).toBeInTheDocument();
    expect(screen.getByText('10/20 personas')).toBeInTheDocument();
  });

  it('should render coach information when available', () => {
    render(<BookingCardDisplay booking={mockBooking} />);

    expect(screen.getByText('Entrenador')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should not render coach section when coach name is null', () => {
    const bookingWithoutCoach: Booking = {
      ...mockBooking,
      coach: { name: null, avatar: null },
    };

    render(<BookingCardDisplay booking={bookingWithoutCoach} />);

    expect(screen.queryByText('Entrenador')).not.toBeInTheDocument();
  });

  it('should display available status badge', () => {
    render(<BookingCardDisplay booking={mockBooking} />);

    expect(screen.getByText('Disponible')).toBeInTheDocument();
  });

  it('should display booked status badge when user is booked', () => {
    const bookedBooking: Booking = {
      ...mockBooking,
      status: 'booked',
      userBookingId: 123,
    };

    render(<BookingCardDisplay booking={bookedBooking} />);

    expect(screen.getByText('Reservada')).toBeInTheDocument();
  });

  it('should render actions slot when provided', () => {
    const mockAction = <button>Test Action</button>;

    render(
      <BookingCardDisplay
        booking={mockBooking}
        actions={mockAction}
      />
    );

    expect(screen.getByRole('button', { name: 'Test Action' })).toBeInTheDocument();
  });

  it('should handle full capacity status', () => {
    const fullBooking: Booking = {
      ...mockBooking,
      status: 'full',
      capacity: {
        ...mockBooking.capacity,
        current: 20,
        available: 0,
        percentage: 100,
      },
    };

    render(<BookingCardDisplay booking={fullBooking} />);

    expect(screen.getByText('Lleno')).toBeInTheDocument();
  });

  it('should handle waitlist status', () => {
    const waitlistBooking: Booking = {
      ...mockBooking,
      status: 'waitlist',
      capacity: {
        ...mockBooking.capacity,
        hasWaitlist: true,
        waitlistCount: 3,
      },
    };

    render(<BookingCardDisplay booking={waitlistBooking} />);

    expect(screen.getByText('Lista de espera')).toBeInTheDocument();
  });
});
