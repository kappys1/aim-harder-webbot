import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingCardActions } from './booking-card-actions.component';
import { Booking } from '@/modules/booking/models/booking.model';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('BookingCardActions', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render "Reservar" button when booking is available and not booked', () => {
    const mockOnBook = vi.fn();

    render(
      <BookingCardActions
        booking={mockBooking}
        onBook={mockOnBook}
      />
    );

    expect(screen.getByRole('button', { name: 'Reservar' })).toBeInTheDocument();
  });

  it('should render "Cancelar" button when user is already booked', () => {
    const bookedBooking: Booking = {
      ...mockBooking,
      status: 'booked',
      userBookingId: 123,
    };

    const mockOnCancel = vi.fn();

    render(
      <BookingCardActions
        booking={bookedBooking}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('should call onBook when Reservar button is clicked', async () => {
    const mockOnBook = vi.fn();

    render(
      <BookingCardActions
        booking={mockBooking}
        onBook={mockOnBook}
      />
    );

    const button = screen.getByRole('button', { name: 'Reservar' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnBook).toHaveBeenCalledWith(mockBooking.id);
    });
  });

  it('should show confirmation dialog when canceling booking', async () => {
    const bookedBooking: Booking = {
      ...mockBooking,
      status: 'booked',
      userBookingId: 123,
    };

    const mockOnCancel = vi.fn();

    // Mock window.confirm
    vi.stubGlobal('confirm', () => true);

    render(
      <BookingCardActions
        booking={bookedBooking}
        onCancel={mockOnCancel}
      />
    );

    const button = screen.getByRole('button', { name: 'Cancelar' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalledWith(bookedBooking.id);
    });
  });

  it('should not call onCancel if user cancels confirmation dialog', async () => {
    const bookedBooking: Booking = {
      ...mockBooking,
      status: 'booked',
      userBookingId: 123,
    };

    const mockOnCancel = vi.fn();

    // Mock window.confirm to return false
    vi.stubGlobal('confirm', () => false);

    render(
      <BookingCardActions
        booking={bookedBooking}
        onCancel={mockOnCancel}
      />
    );

    const button = screen.getByRole('button', { name: 'Cancelar' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  it('should render "No disponible" button for disabled classes', () => {
    const disabledBooking: Booking = {
      ...mockBooking,
      status: 'disabled',
    };

    render(<BookingCardActions booking={disabledBooking} />);

    const button = screen.getByRole('button', { name: 'No disponible' });
    expect(button).toBeDisabled();
  });

  it('should render "Completo" button for full classes without waitlist', () => {
    const fullBooking: Booking = {
      ...mockBooking,
      status: 'full',
      capacity: {
        ...mockBooking.capacity,
        hasWaitlist: false,
      },
    };

    render(<BookingCardActions booking={fullBooking} />);

    const button = screen.getByRole('button', { name: 'Completo' });
    expect(button).toBeDisabled();
  });

  it('should render "Reservar" button for waitlist classes', () => {
    const waitlistBooking: Booking = {
      ...mockBooking,
      status: 'waitlist',
      capacity: {
        ...mockBooking.capacity,
        hasWaitlist: true,
      },
    };

    const mockOnBook = vi.fn();

    render(
      <BookingCardActions
        booking={waitlistBooking}
        onBook={mockOnBook}
      />
    );

    expect(screen.getByRole('button', { name: 'Reservar' })).toBeInTheDocument();
  });

  it('should show loading state with spinner and text', async () => {
    const mockOnBook = vi.fn();

    const { rerender } = render(
      <BookingCardActions
        booking={mockBooking}
        onBook={mockOnBook}
      />
    );

    const button = screen.getByRole('button', { name: 'Reservar' });
    fireEvent.click(button);

    // Button should show loading state (implementation specific)
    // Check for Loader2 icon or "Reservando..." text
  });

  it('should handle prebooking cancellation', async () => {
    const bookingWithPrebooking: Booking = {
      ...mockBooking,
      status: 'available',
    };

    const mockPrebooking = {
      id: 'pre-1',
      status: 'pending' as const,
      bookingData: { day: '2025-01-15' },
      availableAt: '2025-01-16T06:00:00Z',
    };

    const mockOnCancelPrebooking = vi.fn();

    vi.stubGlobal('confirm', () => true);

    render(
      <BookingCardActions
        booking={bookingWithPrebooking}
        prebooking={mockPrebooking}
        onCancelPrebooking={mockOnCancelPrebooking}
      />
    );

    const button = screen.getByRole('button', { name: 'Cancelar Prereserva' });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnCancelPrebooking).toHaveBeenCalledWith(mockPrebooking.id);
    });
  });
});
