import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayTile } from './day-tile.component';

describe('DayTile', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  describe('Rendering', () => {
    it('should render day tile with date information', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      // Should show day number
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should display day abbreviation', () => {
      const date = new Date('2025-01-15T10:00:00'); // Wednesday

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      // Should show abbreviated day name (mié for miércoles)
      const dayAbbr = screen.getByText('mié');
      expect(dayAbbr).toBeInTheDocument();
    });

    it('should have proper aria-label with full date description', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button).toHaveAttribute('aria-label');

      const ariaLabel = button.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });
  });

  describe('Selected State', () => {
    it('should apply selected styles when isSelected is true', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={true}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button).toHaveAttribute('aria-selected', 'true');
    });

    it('should not have selected attribute when not selected', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Today State', () => {
    it('should indicate today with aria-current attribute', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={true}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button).toHaveAttribute('aria-current', 'date');
    });

    it('should not have aria-current when not today', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button).not.toHaveAttribute('aria-current');
    });

    it('should apply today styles when isToday is true and not selected', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={true}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      // Should have border to indicate today
      expect(button.className).toContain('border');
    });
  });

  describe('Disabled State', () => {
    it('should disable button when isDisabled is true', () => {
      const date = new Date('2025-01-10T10:00:00'); // Past date

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={true}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not call onClick when disabled and clicked', () => {
      const date = new Date('2025-01-10T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={true}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      fireEvent.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should apply disabled styles', () => {
      const date = new Date('2025-01-10T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={true}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button.className).toContain('opacity-50');
      expect(button.className).toContain('cursor-not-allowed');
    });
  });

  describe('Click Interaction', () => {
    it('should call onClick with date when clicked and not disabled', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalledWith(date);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const date = new Date('2025-01-10T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={true}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      fireEvent.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Combined States', () => {
    it('should handle selected and today states together', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={true}
          isToday={true}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button).toHaveAttribute('aria-selected', 'true');
      expect(button).toHaveAttribute('aria-current', 'date');
    });

    it('should prioritize disabled state over other states', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={true}
          isToday={true}
          isDisabled={true}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
          className="custom-class"
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button.className).toContain('custom-class');
    });
  });

  describe('Accessibility', () => {
    it('should have gridcell role', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByRole('gridcell')).toBeInTheDocument();
    });

    it('should provide full date description in aria-label', () => {
      const date = new Date('2025-01-15T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      const ariaLabel = button.getAttribute('aria-label');

      expect(ariaLabel).toBeTruthy();
      expect(typeof ariaLabel).toBe('string');
    });

    it('should indicate disabled state with aria-disabled', () => {
      const date = new Date('2025-01-10T10:00:00');

      render(
        <DayTile
          date={date}
          isSelected={false}
          isToday={false}
          isDisabled={true}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('gridcell');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
