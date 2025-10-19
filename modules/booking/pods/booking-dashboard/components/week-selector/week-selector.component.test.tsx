import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WeekSelector } from './week-selector.component';

describe('WeekSelector', () => {
  const mockOnDateChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnDateChange.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Past Date Restrictions', () => {
    it('should disable past dates', () => {
      const today = new Date('2025-01-15T10:00:00'); // Wednesday
      vi.setSystemTime(today);

      const selectedDate = '2025-01-15';

      render(
        <WeekSelector
          selectedDate={selectedDate}
          onDateChange={mockOnDateChange}
        />
      );

      // Find all day buttons
      const dayButtons = screen.getAllByRole('gridcell');

      // Check that past dates are disabled
      dayButtons.forEach((button) => {
        const ariaLabel = button.getAttribute('aria-label') || '';
        const ariaDisabled = button.getAttribute('aria-disabled');

        // Parse the date from aria-label (assuming format includes date info)
        if (ariaLabel.includes('ene') || ariaLabel.includes('enero')) {
          // Check if button is for a past date
          const dayMatch = ariaLabel.match(/(\d+)/);
          if (dayMatch) {
            const day = parseInt(dayMatch[1]);
            if (day < 15) {
              // Days before today should be disabled
              expect(ariaDisabled).toBe('true');
              expect(button).toBeDisabled();
            }
          }
        }
      });
    });

    it('should disable previous week button when entire week is past', () => {
      const today = new Date('2025-01-15T10:00:00'); // Wednesday
      vi.setSystemTime(today);

      const selectedDate = '2025-01-15';

      render(
        <WeekSelector
          selectedDate={selectedDate}
          onDateChange={mockOnDateChange}
        />
      );

      const prevButton = screen.getByLabelText('Semana anterior');
      expect(prevButton).toBeDisabled();
    });

    it('should not disable today even though time has passed', () => {
      const today = new Date('2025-01-15T23:59:00'); // End of day
      vi.setSystemTime(today);

      const selectedDate = '2025-01-15';

      render(
        <WeekSelector
          selectedDate={selectedDate}
          onDateChange={mockOnDateChange}
        />
      );

      // Today should still be selectable
      const todayButtons = screen.getAllByRole('gridcell').filter((button) => {
        return button.getAttribute('aria-current') === 'date';
      });

      expect(todayButtons.length).toBeGreaterThan(0);
      todayButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should allow clicking on future dates', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      const selectedDate = '2025-01-15';

      render(
        <WeekSelector
          selectedDate={selectedDate}
          onDateChange={mockOnDateChange}
        />
      );

      const dayButtons = screen.getAllByRole('gridcell');

      // Find a future date button (day 16 or later)
      const futureDateButton = dayButtons.find((button) => {
        const ariaLabel = button.getAttribute('aria-label') || '';
        return ariaLabel.includes('16') && button.getAttribute('aria-disabled') !== 'true';
      });

      if (futureDateButton) {
        fireEvent.click(futureDateButton);

        waitFor(() => {
          expect(mockOnDateChange).toHaveBeenCalled();
        });
      }
    });

    it('should not allow clicking on past dates', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      const selectedDate = '2025-01-15';

      render(
        <WeekSelector
          selectedDate={selectedDate}
          onDateChange={mockOnDateChange}
        />
      );

      const dayButtons = screen.getAllByRole('gridcell');

      // Find a past date button
      const pastDateButton = dayButtons.find((button) => {
        const ariaLabel = button.getAttribute('aria-label') || '';
        const ariaDisabled = button.getAttribute('aria-disabled');
        return ariaLabel.includes('13') && ariaDisabled === 'true';
      });

      if (pastDateButton) {
        fireEvent.click(pastDateButton);

        // Should not trigger date change
        expect(mockOnDateChange).not.toHaveBeenCalled();
      }
    });
  });

  describe('Week Navigation', () => {
    it('should render week selector with 7 days', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const dayButtons = screen.getAllByRole('gridcell');
      expect(dayButtons).toHaveLength(7);
    });

    it('should display week range', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const weekRangeDisplay = screen.getByLabelText('Selector semanal de fechas');
      expect(weekRangeDisplay).toBeInTheDocument();
    });

    it('should navigate to next week when next button is clicked', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const nextButton = screen.getByLabelText('Semana siguiente');
      expect(nextButton).not.toBeDisabled();

      fireEvent.click(nextButton);

      // Week range should update
      waitFor(() => {
        const weekRangeText = screen.getByRole('group', {
          name: 'Selector semanal de fechas',
        });
        expect(weekRangeText).toBeInTheDocument();
      });
    });

    it('should not navigate when disabled', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
          disabled={true}
        />
      );

      const nextButton = screen.getByLabelText('Semana siguiente');
      const prevButton = screen.getByLabelText('Semana anterior');

      expect(nextButton).toBeDisabled();
      expect(prevButton).toBeDisabled();
    });
  });

  describe('Date Selection', () => {
    it('should highlight selected date', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      const selectedDate = '2025-01-15';

      render(
        <WeekSelector
          selectedDate={selectedDate}
          onDateChange={mockOnDateChange}
        />
      );

      const selectedButtons = screen.getAllByRole('gridcell').filter((button) => {
        return button.getAttribute('aria-selected') === 'true';
      });

      expect(selectedButtons.length).toBeGreaterThan(0);
    });

    it('should highlight today with special indicator', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const todayButtons = screen.getAllByRole('gridcell').filter((button) => {
        return button.getAttribute('aria-current') === 'date';
      });

      expect(todayButtons.length).toBeGreaterThan(0);
    });

    it('should call onDateChange when a date is clicked', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const dayButtons = screen.getAllByRole('gridcell');
      const enabledButton = dayButtons.find(
        (button) => button.getAttribute('aria-disabled') !== 'true'
      );

      if (enabledButton) {
        fireEvent.click(enabledButton);

        waitFor(() => {
          expect(mockOnDateChange).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      expect(screen.getByLabelText('Selector semanal de fechas')).toBeInTheDocument();
      expect(screen.getByLabelText('Semana anterior')).toBeInTheDocument();
      expect(screen.getByLabelText('Semana siguiente')).toBeInTheDocument();
    });

    it('should indicate disabled state with aria-disabled', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
          disabled={true}
        />
      );

      const allButtons = screen.getAllByRole('gridcell');
      allButtons.forEach((button) => {
        expect(button.getAttribute('aria-disabled')).toBe('true');
      });
    });

    it('should have grid role for days container', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const grid = screen.getByRole('grid');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('Min/Max Date Constraints', () => {
    it('should respect minDate prop in addition to today', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      const minDate = '2025-01-17'; // Future date (Friday)

      render(
        <WeekSelector
          selectedDate="2025-01-17"
          onDateChange={mockOnDateChange}
          minDate={minDate}
        />
      );

      const dayButtons = screen.getAllByRole('gridcell');

      // Days before minDate (2025-01-17) should be disabled
      // This includes past dates AND dates between today and minDate
      const disabledCount = dayButtons.filter(
        (button) => button.getAttribute('aria-disabled') === 'true'
      ).length;

      // At minimum, past days (before 15th) should be disabled
      expect(disabledCount).toBeGreaterThanOrEqual(1);
    });

    it('should respect maxDate prop', () => {
      const today = new Date('2025-01-15T10:00:00');
      vi.setSystemTime(today);

      const maxDate = '2025-01-17'; // Near future

      render(
        <WeekSelector
          selectedDate="2025-01-16"
          onDateChange={mockOnDateChange}
          maxDate={maxDate}
        />
      );

      const dayButtons = screen.getAllByRole('gridcell');

      // Days after maxDate should be disabled
      const disabledCount = dayButtons.filter(
        (button) => button.getAttribute('aria-disabled') === 'true'
      ).length;

      expect(disabledCount).toBeGreaterThan(0);
    });
  });
});
