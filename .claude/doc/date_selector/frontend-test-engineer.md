# WeekSelector Component - Comprehensive Test Implementation Plan

## Executive Summary

This document outlines a comprehensive test-driven development (TDD) plan for the WeekSelector component implementation. The plan follows React Testing Library best practices and Vitest testing framework patterns, focusing on behavior verification rather than implementation details.

## Project Context Analysis

### Current Testing Environment
- **No existing test framework**: Project requires Vitest setup from scratch
- **No existing test files**: This will be the first test implementation
- **Dependencies available**: date-fns (v4.1.0), React 19.1.0, shadcn/ui components
- **Architecture**: Feature-based structure with booking module

### Component Architecture to Test
1. **WeekSelector** - Main component with week navigation and date selection
2. **DayTile** - Individual day subcomponent with accessibility features
3. **useWeekNavigation** - Custom hook for week navigation logic
4. **Integration** - Bidirectional sync with existing date input in booking dashboard

## Test Implementation Strategy

### Phase 1: Test Environment Setup

#### 1.1 Required Dependencies
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jsdom": "^23.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

#### 1.2 Vitest Configuration
**File**: `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/common': path.resolve(__dirname, './common'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
    },
  },
});
```

#### 1.3 Test Setup File
**File**: `src/test/setup.ts`
```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock date-fns locale
vi.mock('date-fns/locale', () => ({
  es: {
    localize: {
      day: vi.fn((n) => ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][n]),
      month: vi.fn((n) => ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][n]),
    },
    formatLong: {
      date: vi.fn(() => 'P'),
      time: vi.fn(() => 'p'),
      dateTime: vi.fn(() => 'Pp'),
    },
  },
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
```

### Phase 2: Test Utilities and Fixtures

#### 2.1 Custom Render Function
**File**: `modules/booking/pods/booking-dashboard/components/week-selector/__tests__/test-utils.tsx`
```typescript
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { BookingProvider } from '../../../../hooks/useBookingContext.hook';
import { AuthCookie } from '../../../../../auth/api/services/cookie.service';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialDate?: string;
  initialBoxId?: string;
  authCookies?: AuthCookie[];
}

const AllTheProviders = ({
  children,
  initialDate = '2025-01-15',
  initialBoxId = 'test-box-1'
}: {
  children: React.ReactNode;
  initialDate?: string;
  initialBoxId?: string;
}) => {
  return (
    <BookingProvider initialDate={initialDate} initialBoxId={initialBoxId}>
      {children}
    </BookingProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialDate, initialBoxId, authCookies, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders
        initialDate={initialDate}
        initialBoxId={initialBoxId}
      >
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

export * from '@testing-library/react';
export { customRender as render };
```

#### 2.2 Test Fixtures and Mocks
**File**: `modules/booking/pods/booking-dashboard/components/week-selector/__tests__/fixtures.ts`
```typescript
import { BookingDay, Booking, BookingStatus } from '../../../../models/booking.model';

export const createMockDate = (dateString: string) => new Date(dateString);

export const createMockBookingDay = (date: string): BookingDay => ({
  date,
  description: `Bookings for ${date}`,
  availableClasses: 'CrossFit, Yoga, HIIT',
  bookings: createMockBookings(),
  timeSlots: [
    { id: 'slot-1', time: '09:00', startTime: '09:00', endTime: '10:00' },
    { id: 'slot-2', time: '10:00', startTime: '10:00', endTime: '11:00' },
  ],
  specialEvents: [],
});

export const createMockBookings = (): Booking[] => [
  {
    id: 1,
    timeSlot: { id: 'slot-1', time: '09:00', startTime: '09:00', endTime: '10:00' },
    class: { id: 1, name: 'CrossFit', description: 'High intensity workout', color: '#FF0000', duration: 60, isOnline: false },
    box: { id: 'box-1', name: 'Test Box', address: 'Test Address', image: 'test.jpg' },
    coach: { name: 'Test Coach', avatar: 'avatar.jpg' },
    status: BookingStatus.AVAILABLE,
    capacity: { current: 5, limit: 10, available: 5, percentage: 50, hasWaitlist: false, waitlistCount: 0 },
    userBookingId: null,
    isIncludedInPlan: true,
    hasZoomAccess: false,
  },
];

export const mockDateFns = {
  startOfWeek: vi.fn(),
  endOfWeek: vi.fn(),
  eachDayOfInterval: vi.fn(),
  format: vi.fn(),
  parseISO: vi.fn(),
  isSameDay: vi.fn(),
  addWeeks: vi.fn(),
  subWeeks: vi.fn(),
  isValid: vi.fn(() => true),
};
```

### Phase 3: Unit Tests - Core Logic

#### 3.1 useWeekNavigation Hook Tests
**File**: `modules/booking/pods/booking-dashboard/components/week-selector/__tests__/useWeekNavigation.hook.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWeekNavigation } from '../hooks/useWeekNavigation.hook';
import * as dateFns from 'date-fns';

// Mock date-fns
vi.mock('date-fns', () => ({
  startOfWeek: vi.fn(),
  endOfWeek: vi.fn(),
  eachDayOfInterval: vi.fn(),
  format: vi.fn(),
  parseISO: vi.fn(),
  addWeeks: vi.fn(),
  subWeeks: vi.fn(),
  isSameDay: vi.fn(),
}));

describe('useWeekNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    (dateFns.parseISO as any).mockImplementation((date) => new Date(date));
    (dateFns.startOfWeek as any).mockImplementation((date) => new Date(2025, 0, 13)); // Monday
    (dateFns.endOfWeek as any).mockImplementation((date) => new Date(2025, 0, 19)); // Sunday
    (dateFns.eachDayOfInterval as any).mockReturnValue([
      new Date(2025, 0, 13), // Monday
      new Date(2025, 0, 14), // Tuesday
      new Date(2025, 0, 15), // Wednesday
      new Date(2025, 0, 16), // Thursday
      new Date(2025, 0, 17), // Friday
      new Date(2025, 0, 18), // Saturday
      new Date(2025, 0, 19), // Sunday
    ]);
    (dateFns.format as any).mockImplementation((date, formatStr) => {
      if (formatStr.includes('MMM')) return '13 Ene - 19 Ene';
      return '13';
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct week for given date', () => {
      const { result } = renderHook(() =>
        useWeekNavigation('2025-01-15', vi.fn())
      );

      expect(result.current.currentWeek).toHaveLength(7);
      expect(result.current.weekRange).toBe('13 Ene - 19 Ene');
      expect(result.current.isNavigating).toBe(false);
    });

    it('should handle invalid date gracefully', () => {
      (dateFns.parseISO as any).mockReturnValue(new Date('invalid'));

      const { result } = renderHook(() =>
        useWeekNavigation('invalid-date', vi.fn())
      );

      expect(result.current.currentWeek).toHaveLength(7);
    });
  });

  describe('Week Navigation', () => {
    it('should navigate to next week', async () => {
      const onDateChange = vi.fn();
      const { result } = renderHook(() =>
        useWeekNavigation('2025-01-15', onDateChange)
      );

      (dateFns.addWeeks as any).mockReturnValue(new Date(2025, 0, 20));

      await act(async () => {
        result.current.navigateToNextWeek();
      });

      expect(dateFns.addWeeks).toHaveBeenCalledWith(expect.any(Date), 1);
      expect(result.current.isNavigating).toBe(false);
    });

    it('should navigate to previous week', async () => {
      const onDateChange = vi.fn();
      const { result } = renderHook(() =>
        useWeekNavigation('2025-01-15', onDateChange)
      );

      (dateFns.subWeeks as any).mockReturnValue(new Date(2025, 0, 6));

      await act(async () => {
        result.current.navigateToPrevWeek();
      });

      expect(dateFns.subWeeks).toHaveBeenCalledWith(expect.any(Date), 1);
      expect(result.current.isNavigating).toBe(false);
    });

    it('should navigate to specific week containing given date', async () => {
      const onDateChange = vi.fn();
      const { result } = renderHook(() =>
        useWeekNavigation('2025-01-15', onDateChange)
      );

      const targetDate = new Date(2025, 1, 10);

      await act(async () => {
        result.current.navigateToWeek(targetDate);
      });

      expect(dateFns.startOfWeek).toHaveBeenCalledWith(targetDate, { weekStartsOn: 1 });
    });
  });

  describe('Date Selection', () => {
    it('should call onDateChange with correct format when date selected', async () => {
      const onDateChange = vi.fn();
      const { result } = renderHook(() =>
        useWeekNavigation('2025-01-15', onDateChange)
      );

      const selectedDate = new Date(2025, 0, 16);
      (dateFns.format as any).mockReturnValue('2025-01-16');

      await act(async () => {
        result.current.selectDate(selectedDate);
      });

      expect(dateFns.format).toHaveBeenCalledWith(selectedDate, 'yyyy-MM-dd');
      expect(onDateChange).toHaveBeenCalledWith('2025-01-16');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid navigation clicks', async () => {
      const onDateChange = vi.fn();
      const { result } = renderHook(() =>
        useWeekNavigation('2025-01-15', onDateChange)
      );

      // Simulate rapid clicks
      await act(async () => {
        result.current.navigateToNextWeek();
        result.current.navigateToNextWeek();
        result.current.navigateToNextWeek();
      });

      // Should only process the last navigation
      expect(dateFns.addWeeks).toHaveBeenCalledTimes(3);
    });

    it('should handle year boundary transitions', async () => {
      const onDateChange = vi.fn();

      // Start at end of year
      (dateFns.parseISO as any).mockReturnValue(new Date(2024, 11, 30));
      (dateFns.addWeeks as any).mockReturnValue(new Date(2025, 0, 6));

      const { result } = renderHook(() =>
        useWeekNavigation('2024-12-30', onDateChange)
      );

      await act(async () => {
        result.current.navigateToNextWeek();
      });

      expect(dateFns.addWeeks).toHaveBeenCalledWith(expect.any(Date), 1);
    });
  });
});
```

#### 3.2 Week Selector Utilities Tests
**File**: `modules/booking/pods/booking-dashboard/components/week-selector/__tests__/week-selector.utils.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeekSelectorUtils } from '../utils/week-selector.utils';
import * as dateFns from 'date-fns';

vi.mock('date-fns');

describe('WeekSelectorUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatWeekRange', () => {
    it('should format week range correctly in Spanish', () => {
      const weekStart = new Date(2025, 0, 13);
      const weekEnd = new Date(2025, 0, 19);

      (dateFns.format as any)
        .mockReturnValueOnce('13 Ene')
        .mockReturnValueOnce('19 Ene');

      const result = WeekSelectorUtils.formatWeekRange(weekStart, weekEnd);

      expect(result).toBe('13 Ene - 19 Ene');
      expect(dateFns.format).toHaveBeenCalledTimes(2);
      expect(dateFns.format).toHaveBeenCalledWith(weekStart, 'd MMM', { locale: expect.any(Object) });
    });

    it('should handle same month range', () => {
      const weekStart = new Date(2025, 0, 13);
      const weekEnd = new Date(2025, 0, 19);

      (dateFns.format as any)
        .mockReturnValueOnce('13')
        .mockReturnValueOnce('19 Ene');

      const result = WeekSelectorUtils.formatWeekRange(weekStart, weekEnd, true);

      expect(result).toBe('13 - 19 Ene');
    });
  });

  describe('isDateInRange', () => {
    it('should return true for date within range', () => {
      const date = new Date(2025, 0, 15);
      const minDate = '2025-01-01';
      const maxDate = '2025-01-31';

      (dateFns.parseISO as any)
        .mockReturnValueOnce(new Date(2025, 0, 1))
        .mockReturnValueOnce(new Date(2025, 0, 31));

      const result = WeekSelectorUtils.isDateInRange(date, minDate, maxDate);

      expect(result).toBe(true);
    });

    it('should return false for date outside range', () => {
      const date = new Date(2025, 1, 15);
      const minDate = '2025-01-01';
      const maxDate = '2025-01-31';

      (dateFns.parseISO as any)
        .mockReturnValueOnce(new Date(2025, 0, 1))
        .mockReturnValueOnce(new Date(2025, 0, 31));

      const result = WeekSelectorUtils.isDateInRange(date, minDate, maxDate);

      expect(result).toBe(false);
    });
  });

  describe('getDayAbbreviation', () => {
    it('should return correct Spanish day abbreviation', () => {
      const date = new Date(2025, 0, 15); // Wednesday

      (dateFns.format as any).mockReturnValue('mié');

      const result = WeekSelectorUtils.getDayAbbreviation(date);

      expect(result).toBe('mié');
      expect(dateFns.format).toHaveBeenCalledWith(date, 'E', { locale: expect.any(Object) });
    });
  });
});
```

### Phase 4: Component Tests - DayTile

#### 4.1 DayTile Component Tests
**File**: `modules/booking/pods/booking-dashboard/components/week-selector/__tests__/day-tile.component.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from './test-utils';
import userEvent from '@testing-library/user-event';
import { DayTile } from '../day-tile.component';

describe('DayTile', () => {
  const mockOnClick = vi.fn();
  const testDate = new Date(2025, 0, 15); // Wednesday, Jan 15, 2025

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render day abbreviation and number', () => {
      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.getByText('mié')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    it('should apply selected styles when isSelected is true', () => {
      render(
        <DayTile
          date={testDate}
          isSelected={true}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
    });

    it('should apply today styles when isToday is true', () => {
      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={true}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('border', 'border-primary');
    });

    it('should be disabled when isDisabled is true', () => {
      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={false}
          isDisabled={true}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA label', () => {
      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'mié, 15 de enero');
    });

    it('should have aria-selected when selected', () => {
      render(
        <DayTile
          date={testDate}
          isSelected={true}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-selected', 'true');
    });

    it('should have aria-current when today', () => {
      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={true}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-current', 'date');
    });

    it('should be focusable with keyboard', async () => {
      const user = userEvent.setup();

      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');

      await user.tab();
      expect(button).toHaveFocus();
    });
  });

  describe('User Interactions', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();

      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(testDate);
    });

    it('should call onClick when Enter is pressed', async () => {
      const user = userEvent.setup();

      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(testDate);
    });

    it('should call onClick when Space is pressed', async () => {
      const user = userEvent.setup();

      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');

      expect(mockOnClick).toHaveBeenCalledTimes(1);
      expect(mockOnClick).toHaveBeenCalledWith(testDate);
    });

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup();

      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={false}
          isDisabled={true}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Visual States', () => {
    it('should combine selected and today styles correctly', () => {
      render(
        <DayTile
          date={testDate}
          isSelected={true}
          isToday={true}
          isDisabled={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary', 'text-primary-foreground');
      // When selected, today border should not be visible (selected takes precedence)
    });

    it('should apply custom className', () => {
      render(
        <DayTile
          date={testDate}
          isSelected={false}
          isToday={false}
          isDisabled={false}
          onClick={mockOnClick}
          className="custom-class"
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });
});
```

### Phase 5: Component Tests - WeekSelector

#### 5.1 WeekSelector Component Tests
**File**: `modules/booking/pods/booking-dashboard/components/week-selector/__tests__/week-selector.component.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from './test-utils';
import userEvent from '@testing-library/user-event';
import { WeekSelector } from '../week-selector.component';

// Mock the useWeekNavigation hook
vi.mock('../hooks/useWeekNavigation.hook', () => ({
  useWeekNavigation: vi.fn(),
}));

import { useWeekNavigation } from '../hooks/useWeekNavigation.hook';

describe('WeekSelector', () => {
  const mockOnDateChange = vi.fn();
  const mockNavigateToNextWeek = vi.fn();
  const mockNavigateToPrevWeek = vi.fn();
  const mockSelectDate = vi.fn();

  const mockWeekDays = [
    new Date(2025, 0, 13), // Monday
    new Date(2025, 0, 14), // Tuesday
    new Date(2025, 0, 15), // Wednesday
    new Date(2025, 0, 16), // Thursday
    new Date(2025, 0, 17), // Friday
    new Date(2025, 0, 18), // Saturday
    new Date(2025, 0, 19), // Sunday
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    (useWeekNavigation as any).mockReturnValue({
      currentWeek: mockWeekDays,
      weekRange: '13 Ene - 19 Ene',
      navigateToNextWeek: mockNavigateToNextWeek,
      navigateToPrevWeek: mockNavigateToPrevWeek,
      selectDate: mockSelectDate,
      isNavigating: false,
    });
  });

  describe('Rendering', () => {
    it('should render week range display', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      expect(screen.getByText('13 Ene - 19 Ene')).toBeInTheDocument();
    });

    it('should render navigation buttons', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      expect(screen.getByLabelText('Semana anterior')).toBeInTheDocument();
      expect(screen.getByLabelText('Semana siguiente')).toBeInTheDocument();
    });

    it('should render all day tiles', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      // Should render 7 day tiles
      const dayTiles = screen.getAllByRole('button', { name: /\w{3}, \d+ de \w+/ });
      expect(dayTiles).toHaveLength(7);
    });

    it('should highlight selected day', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const selectedDay = screen.getByRole('button', { name: /mié, 15 de enero/ });
      expect(selectedDay).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have proper group role and label', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const weekSelector = screen.getByRole('group');
      expect(weekSelector).toHaveAttribute('aria-label', 'Selector semanal de fechas');
    });

    it('should have live region for week range', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const weekRange = screen.getByText('13 Ene - 19 Ene');
      expect(weekRange).toHaveAttribute('aria-live', 'polite');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const prevButton = screen.getByLabelText('Semana anterior');

      await user.tab();
      expect(prevButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(mockNavigateToPrevWeek).toHaveBeenCalledTimes(1);
    });
  });

  describe('Navigation', () => {
    it('should navigate to previous week when button clicked', async () => {
      const user = userEvent.setup();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const prevButton = screen.getByLabelText('Semana anterior');
      await user.click(prevButton);

      expect(mockNavigateToPrevWeek).toHaveBeenCalledTimes(1);
    });

    it('should navigate to next week when button clicked', async () => {
      const user = userEvent.setup();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const nextButton = screen.getByLabelText('Semana siguiente');
      await user.click(nextButton);

      expect(mockNavigateToNextWeek).toHaveBeenCalledTimes(1);
    });

    it('should disable navigation when loading', () => {
      (useWeekNavigation as any).mockReturnValue({
        currentWeek: mockWeekDays,
        weekRange: '13 Ene - 19 Ene',
        navigateToNextWeek: mockNavigateToNextWeek,
        navigateToPrevWeek: mockNavigateToPrevWeek,
        selectDate: mockSelectDate,
        isNavigating: true,
      });

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const prevButton = screen.getByLabelText('Semana anterior');
      const nextButton = screen.getByLabelText('Semana siguiente');

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });

    it('should disable navigation when component is disabled', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
          disabled={true}
        />
      );

      const prevButton = screen.getByLabelText('Semana anterior');
      const nextButton = screen.getByLabelText('Semana siguiente');

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Date Selection', () => {
    it('should select day when day tile clicked', async () => {
      const user = userEvent.setup();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const thursdayTile = screen.getByRole('button', { name: /jue, 16 de enero/ });
      await user.click(thursdayTile);

      expect(mockSelectDate).toHaveBeenCalledWith(new Date(2025, 0, 16));
    });

    it('should call onDateChange when date selected', async () => {
      const user = userEvent.setup();

      // Mock selectDate to call onDateChange
      mockSelectDate.mockImplementation((date) => {
        mockOnDateChange('2025-01-16');
      });

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const thursdayTile = screen.getByRole('button', { name: /jue, 16 de enero/ });
      await user.click(thursdayTile);

      expect(mockOnDateChange).toHaveBeenCalledWith('2025-01-16');
    });
  });

  describe('Props Handling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
          className="custom-week-selector"
        />
      );

      const weekSelector = container.firstChild as HTMLElement;
      expect(weekSelector).toHaveClass('custom-week-selector');
    });

    it('should respect minDate constraint', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
          minDate="2025-01-16"
        />
      );

      // Days before minDate should be disabled
      const mondayTile = screen.getByRole('button', { name: /lun, 13 de enero/ });
      expect(mondayTile).toBeDisabled();
    });

    it('should respect maxDate constraint', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
          maxDate="2025-01-16"
        />
      );

      // Days after maxDate should be disabled
      const sundayTile = screen.getByRole('button', { name: /dom, 19 de enero/ });
      expect(sundayTile).toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty selectedDate gracefully', () => {
      expect(() => {
        render(
          <WeekSelector
            selectedDate=""
            onDateChange={mockOnDateChange}
          />
        );
      }).not.toThrow();
    });

    it('should handle invalid selectedDate gracefully', () => {
      expect(() => {
        render(
          <WeekSelector
            selectedDate="invalid-date"
            onDateChange={mockOnDateChange}
          />
        );
      }).not.toThrow();
    });

    it('should update when selectedDate prop changes', () => {
      const { rerender } = render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      rerender(
        <WeekSelector
          selectedDate="2025-01-20"
          onDateChange={mockOnDateChange}
        />
      );

      // Hook should be called with new date
      expect(useWeekNavigation).toHaveBeenCalledWith('2025-01-20', mockOnDateChange);
    });
  });
});
```

### Phase 6: Integration Tests

#### 6.1 Integration with Booking Dashboard
**File**: `modules/booking/pods/booking-dashboard/__tests__/booking-dashboard-week-selector.integration.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookingDashboardComponent } from '../booking-dashboard.component';
import { createMockBookingDay } from './fixtures';

// Mock the booking hook
vi.mock('../../hooks/useBooking.hook', () => ({
  useBooking: vi.fn(),
}));

// Mock WeekSelector component
vi.mock('../components/week-selector/week-selector.component', () => ({
  WeekSelector: vi.fn(({ selectedDate, onDateChange }) => (
    <div data-testid="week-selector">
      <span>WeekSelector: {selectedDate}</span>
      <button onClick={() => onDateChange('2025-01-20')}>
        Change Date
      </button>
    </div>
  )),
}));

import { useBooking } from '../../hooks/useBooking.hook';

describe('Booking Dashboard - WeekSelector Integration', () => {
  const mockSetDate = vi.fn();
  const mockRefetch = vi.fn();

  const defaultBookingData = {
    bookingDay: createMockBookingDay('2025-01-15'),
    isLoading: false,
    error: null,
    refetch: mockRefetch,
    setDate: mockSetDate,
    retryOnError: vi.fn(),
    statistics: { booked: 5 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useBooking as any).mockReturnValue(defaultBookingData);
  });

  describe('Component Coexistence', () => {
    it('should render both date input and WeekSelector', () => {
      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="test-box"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      // Both components should be present
      expect(screen.getByDisplayValue('2025-01-15')).toBeInTheDocument(); // Date input
      expect(screen.getByTestId('week-selector')).toBeInTheDocument(); // WeekSelector
    });

    it('should sync when date input changes', async () => {
      const user = userEvent.setup();

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="test-box"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      const dateInput = screen.getByDisplayValue('2025-01-15');

      await user.clear(dateInput);
      await user.type(dateInput, '2025-01-20');

      expect(mockSetDate).toHaveBeenCalledWith('2025-01-20');
    });

    it('should sync when WeekSelector changes', async () => {
      const user = userEvent.setup();

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="test-box"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      const changeDateButton = screen.getByText('Change Date');
      await user.click(changeDateButton);

      expect(mockSetDate).toHaveBeenCalledWith('2025-01-20');
    });
  });

  describe('Bidirectional Synchronization', () => {
    it('should update both components when booking date changes', () => {
      const { rerender } = render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="test-box"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      // Update booking data
      (useBooking as any).mockReturnValue({
        ...defaultBookingData,
        bookingDay: createMockBookingDay('2025-01-20'),
      });

      rerender(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="test-box"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      expect(screen.getByDisplayValue('2025-01-20')).toBeInTheDocument();
      expect(screen.getByText('WeekSelector: 2025-01-20')).toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('should disable both components when loading', () => {
      (useBooking as any).mockReturnValue({
        ...defaultBookingData,
        isLoading: true,
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="test-box"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      const dateInput = screen.getByDisplayValue('2025-01-15');
      expect(dateInput).toBeDisabled();

      // WeekSelector should also be disabled (checked via props)
      expect(screen.getByTestId('week-selector')).toBeInTheDocument();
    });

    it('should maintain functionality during error states', () => {
      (useBooking as any).mockReturnValue({
        ...defaultBookingData,
        error: 'Network error',
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="test-box"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      // Both components should still be functional
      expect(screen.getByDisplayValue('2025-01-15')).toBeInTheDocument();
      expect(screen.getByTestId('week-selector')).toBeInTheDocument();
      expect(screen.getByText(/Error al cargar las reservas/)).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('should maintain proper layout on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <BookingDashboardComponent
          initialDate="2025-01-15"
          initialBoxId="test-box"
          authCookies={[]}
          isAuthenticated={true}
        />
      );

      const headerControls = screen.getByDisplayValue('2025-01-15').closest('.flex');
      expect(headerControls).toHaveClass('items-center', 'gap-2');
    });
  });
});
```

#### 6.2 Accessibility Integration Tests
**File**: `modules/booking/pods/booking-dashboard/components/week-selector/__tests__/accessibility.integration.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from './test-utils';
import userEvent from '@testing-library/user-event';
import { WeekSelector } from '../week-selector.component';

describe('WeekSelector - Accessibility Integration', () => {
  const mockOnDateChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Screen Reader Support', () => {
    it('should announce week changes', async () => {
      const user = userEvent.setup();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const weekRange = screen.getByText(/\d+ \w+ - \d+ \w+/);
      expect(weekRange).toHaveAttribute('aria-live', 'polite');

      // Week range should be announced to screen readers
      const nextButton = screen.getByLabelText('Semana siguiente');
      await user.click(nextButton);

      // New week range should be announced
      expect(weekRange).toHaveAttribute('aria-live', 'polite');
    });

    it('should provide complete context for each day', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const dayTiles = screen.getAllByRole('button', { name: /\w{3}, \d+ de \w+/ });

      dayTiles.forEach(tile => {
        // Each tile should have descriptive label
        expect(tile).toHaveAttribute('aria-label');
        expect(tile.getAttribute('aria-label')).toMatch(/\w{3}, \d+ de \w+/);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      // Start from previous week button
      const prevButton = screen.getByLabelText('Semana anterior');
      prevButton.focus();

      // Tab through all interactive elements
      await user.tab(); // Next week button
      const nextButton = screen.getByLabelText('Semana siguiente');
      expect(nextButton).toHaveFocus();

      await user.tab(); // First day tile
      const firstDay = screen.getAllByRole('button', { name: /\w{3}, \d+ de \w+/ })[0];
      expect(firstDay).toHaveFocus();

      // Continue through all day tiles
      for (let i = 1; i < 7; i++) {
        await user.tab();
        const dayTile = screen.getAllByRole('button', { name: /\w{3}, \d+ de \w+/ })[i];
        expect(dayTile).toHaveFocus();
      }
    });

    it('should support arrow key navigation within days', async () => {
      const user = userEvent.setup();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const firstDay = screen.getAllByRole('button', { name: /\w{3}, \d+ de \w+/ })[0];
      firstDay.focus();

      // Arrow right should move to next day
      await user.keyboard('{ArrowRight}');
      const secondDay = screen.getAllByRole('button', { name: /\w{3}, \d+ de \w+/ })[1];
      expect(secondDay).toHaveFocus();

      // Arrow left should move back
      await user.keyboard('{ArrowLeft}');
      expect(firstDay).toHaveFocus();
    });

    it('should handle Home/End keys', async () => {
      const user = userEvent.setup();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const middleDay = screen.getAllByRole('button', { name: /\w{3}, \d+ de \w+/ })[3];
      middleDay.focus();

      // Home should go to first day
      await user.keyboard('{Home}');
      const firstDay = screen.getAllByRole('button', { name: /\w{3}, \d+ de \w+/ })[0];
      expect(firstDay).toHaveFocus();

      // End should go to last day
      await user.keyboard('{End}');
      const lastDay = screen.getAllByRole('button', { name: /\w{3}, \d+ de \w+/ })[6];
      expect(lastDay).toHaveFocus();
    });
  });

  describe('Focus Management', () => {
    it('should maintain focus after week navigation', async () => {
      const user = userEvent.setup();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const nextButton = screen.getByLabelText('Semana siguiente');
      await user.click(nextButton);

      // Focus should remain on the next button
      expect(nextButton).toHaveFocus();
    });

    it('should provide visible focus indicators', () => {
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const buttons = screen.getAllByRole('button');

      buttons.forEach(button => {
        // All buttons should have focus-visible styles
        expect(button).toHaveClass('focus-visible:ring-ring/50');
      });
    });
  });

  describe('High Contrast Mode', () => {
    it('should maintain usability in high contrast mode', () => {
      // Simulate high contrast mode
      document.body.classList.add('high-contrast');

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const selectedDay = screen.getByRole('button', { name: /mié, 15 de enero/ });

      // Selected day should have sufficient contrast
      expect(selectedDay).toHaveClass('bg-primary', 'text-primary-foreground');

      document.body.classList.remove('high-contrast');
    });
  });

  describe('Reduced Motion', () => {
    it('should respect reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      // Animations should be disabled or reduced
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Check that animations respect reduced motion
        expect(button).not.toHaveClass('animate-pulse', 'animate-spin');
      });
    });
  });
});
```

### Phase 7: Performance Tests

#### 7.1 Performance and Memory Tests
**File**: `modules/booking/pods/booking-dashboard/components/week-selector/__tests__/performance.test.tsx`
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from './test-utils';
import { WeekSelector } from '../week-selector.component';

describe('WeekSelector - Performance', () => {
  const mockOnDateChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering Performance', () => {
    it('should render within acceptable time', () => {
      const startTime = performance.now();

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in less than 50ms
      expect(renderTime).toBeLessThan(50);
    });

    it('should handle rapid prop changes efficiently', () => {
      const { rerender } = render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const startTime = performance.now();

      // Simulate rapid date changes
      for (let i = 16; i <= 20; i++) {
        rerender(
          <WeekSelector
            selectedDate={`2025-01-${i}`}
            onDateChange={mockOnDateChange}
          />
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle 5 updates in less than 100ms
      expect(totalTime).toBeLessThan(100);
    });
  });

  describe('Memory Management', () => {
    it('should not create memory leaks', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Render and unmount multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <WeekSelector
            selectedDate="2025-01-15"
            onDateChange={mockOnDateChange}
          />
        );
        unmount();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should cleanup event listeners properly', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      const addedListeners = addEventListenerSpy.mock.calls.length;

      unmount();

      const removedListeners = removeEventListenerSpy.mock.calls.length;

      // All added listeners should be removed
      expect(removedListeners).toBe(addedListeners);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Date Calculations', () => {
    it('should memoize expensive date calculations', () => {
      const dateFnsSpy = vi.spyOn(require('date-fns'), 'eachDayOfInterval');

      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      // Initial calculation
      expect(dateFnsSpy).toHaveBeenCalledTimes(1);

      // Re-render with same date should not recalculate
      render(
        <WeekSelector
          selectedDate="2025-01-15"
          onDateChange={mockOnDateChange}
        />
      );

      expect(dateFnsSpy).toHaveBeenCalledTimes(1);

      dateFnsSpy.mockRestore();
    });
  });

  describe('Bundle Size Impact', () => {
    it('should not import unnecessary date-fns functions', () => {
      // This test would be implemented as part of bundle analysis
      // Here we're checking that only required functions are used
      const requiredFunctions = [
        'startOfWeek',
        'endOfWeek',
        'eachDayOfInterval',
        'format',
        'parseISO',
        'isSameDay',
        'addWeeks',
        'subWeeks'
      ];

      requiredFunctions.forEach(func => {
        expect(require('date-fns')[func]).toBeDefined();
      });
    });
  });
});
```

### Phase 8: Test Scripts and Configuration

#### 8.1 Package.json Test Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest run --coverage",
    "test:week-selector": "vitest run modules/booking/pods/booking-dashboard/components/week-selector",
    "test:accessibility": "vitest run --grep=\"accessibility\"",
    "test:integration": "vitest run --grep=\"integration\"",
    "test:performance": "vitest run --grep=\"performance\""
  }
}
```

#### 8.2 CI/CD Test Configuration
**File**: `.github/workflows/test-week-selector.yml`
```yaml
name: WeekSelector Component Tests

on:
  pull_request:
    paths:
      - 'modules/booking/pods/booking-dashboard/components/week-selector/**'
      - 'modules/booking/utils/**'
      - 'modules/booking/models/**'

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run WeekSelector tests
        run: npm run test:week-selector

      - name: Run accessibility tests
        run: npm run test:accessibility

      - name: Run integration tests
        run: npm run test:integration

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

## TDD Implementation Workflow

### Phase 1: Red - Write Failing Tests First
1. **Setup test environment** - Install dependencies and configure Vitest
2. **Create test utilities** - Custom render function and fixtures
3. **Write hook tests** - useWeekNavigation logic tests
4. **Write component tests** - DayTile and WeekSelector behavior tests
5. **Write integration tests** - Booking dashboard integration

### Phase 2: Green - Implement Components
1. **Implement useWeekNavigation hook** - Based on failing tests
2. **Implement DayTile component** - Make component tests pass
3. **Implement WeekSelector component** - Complete the main component
4. **Integration implementation** - Make booking dashboard tests pass

### Phase 3: Refactor - Optimize and Clean
1. **Performance optimization** - Memoization and efficient re-renders
2. **Accessibility improvements** - Enhanced ARIA support
3. **Code cleanup** - Remove duplication and improve readability
4. **Test optimization** - Reduce test execution time

## Coverage Requirements

### Target Coverage Metrics
- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 95%+
- **Lines**: 90%+

### Critical Path Coverage
- Date navigation logic: 100%
- User interaction handlers: 100%
- Accessibility features: 100%
- Integration points: 95%
- Error handling: 85%

## Quality Assurance Checklist

### Pre-implementation Validation
- [ ] Test environment properly configured
- [ ] All dependencies installed and mocked appropriately
- [ ] Custom render utilities created
- [ ] Test fixtures comprehensive and realistic
- [ ] Accessibility testing patterns established

### Implementation Validation
- [ ] All tests passing consistently
- [ ] No console errors or warnings
- [ ] Performance benchmarks met
- [ ] Memory leaks prevented
- [ ] Bundle size impact within limits

### Post-implementation Validation
- [ ] Integration tests verify bidirectional sync
- [ ] Accessibility audit passes
- [ ] Mobile responsiveness tested
- [ ] Cross-browser compatibility verified
- [ ] Real device testing completed

## Questions for User Clarification

1. **Testing Framework Preference**: Should we proceed with Vitest setup, or do you prefer Jest or another testing framework?

2. **Test Coverage Tools**: Do you need code coverage reporting integrated with CI/CD?

3. **Accessibility Testing Depth**: Should we include automated accessibility testing tools like axe-core or jest-axe?

4. **Performance Testing Scope**: How deep should performance testing go? Should we include bundle size analysis?

5. **Mobile Testing Strategy**: Do you need specific mobile device testing or is responsive design testing sufficient?

6. **Browser Support Requirements**: Which browsers need to be supported for cross-browser testing?

7. **Integration Testing Scope**: Should we test integration with the entire booking system or focus on the date selector component integration?

8. **Mocking Strategy**: Are there specific API endpoints or external dependencies that need special mocking considerations?

## Implementation Notes

This comprehensive test plan follows TDD principles and provides extensive coverage for the WeekSelector component. The tests verify behavior rather than implementation details, ensuring maintainable and valuable test suites that will catch real bugs and provide confidence during refactoring.

The plan includes setup for a complete testing environment that doesn't currently exist in the project, making it a foundation for future testing efforts across the entire application.