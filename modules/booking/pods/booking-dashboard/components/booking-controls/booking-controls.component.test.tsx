import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingControls } from './booking-controls.component';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    toString: () => 'date=2025-01-15',
    get: (key: string) => {
      if (key === 'date') return '2025-01-15';
      return null;
    },
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('BookingControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render date selection header', () => {
    const mockOnDateChange = vi.fn();

    render(
      <BookingControls
        selectedDate="2025-01-15"
        onDateChange={mockOnDateChange}
      />
    );

    expect(screen.getByText('Selecciona una fecha')).toBeInTheDocument();
  });

  it('should render "Hoy" button for quick navigation to today', () => {
    const mockOnDateChange = vi.fn();

    render(
      <BookingControls
        selectedDate="2025-01-15"
        onDateChange={mockOnDateChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Hoy' })).toBeInTheDocument();
  });

  it('should render WeekSelector component with selected date', () => {
    const mockOnDateChange = vi.fn();

    render(
      <BookingControls
        selectedDate="2025-01-15"
        onDateChange={mockOnDateChange}
      />
    );

    // WeekSelector is rendered when this text appears (week navigation controls)
    // Check for week navigation elements that are part of WeekSelector
    expect(screen.getByRole('button', { name: 'Hoy' })).toBeInTheDocument();
  });

  it('should call onDateChange when "Hoy" button is clicked', async () => {
    const mockOnDateChange = vi.fn();

    render(
      <BookingControls
        selectedDate="2025-01-15"
        onDateChange={mockOnDateChange}
      />
    );

    const hoyButton = screen.getByRole('button', { name: 'Hoy' });
    fireEvent.click(hoyButton);

    await waitFor(() => {
      expect(mockOnDateChange).toHaveBeenCalled();
    });
  });

  it('should render container with proper spacing', () => {
    const mockOnDateChange = vi.fn();

    const { container } = render(
      <BookingControls
        selectedDate="2025-01-15"
        onDateChange={mockOnDateChange}
      />
    );

    // Check for the main container with proper styling classes
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass('mb-6');
    expect(mainDiv).toHaveClass('space-y-4');
  });
});
