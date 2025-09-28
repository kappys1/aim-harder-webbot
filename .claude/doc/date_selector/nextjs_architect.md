# Next.js WeekSelector Component - Architecture Implementation Plan

## Executive Summary

This document provides a comprehensive Next.js architecture implementation plan for the WeekSelector component, following the project's feature-based architecture with screaming architecture principles. The component will replace the basic HTML date input in the booking dashboard with an intuitive weekly navigation interface.

## Analysis Summary

### Current System Integration Points
- **Location**: `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx:100-106`
- **Current Implementation**: Basic HTML `<input type="date">`
- **Callback Interface**: `handleDateChange(date: string)` - YYYY-MM-DD format
- **State Management**: `useBooking` hook with `setDate` function
- **Existing Utilities**: `BookingUtils.formatDate()` with date-fns and Spanish locale (es)
- **Available Dependencies**: date-fns v4.1.0, lucide-react v0.544.0, Next.js 15.5.4

## Next.js Specific Architecture Recommendations

### 1. Component Structure (Client Components Only)

Since the WeekSelector requires user interactions (clicking, navigation), all components should be **Client Components** with the `"use client"` directive.

```typescript
// File: modules/booking/pods/booking-dashboard/components/week-selector/week-selector.component.tsx
"use client";

import { WeekSelectorProps } from './models/week-selector.model';
import { useWeekNavigation } from './hooks/useWeekNavigation.hook';
import { DayTile } from './day-tile.component';
```

### 2. Optimal File Structure Following Project Conventions

```
modules/booking/pods/booking-dashboard/components/week-selector/
├── week-selector.component.tsx          # Main Client Component
├── day-tile.component.tsx               # Day tile Client Component
├── week-selector.test.tsx               # Component tests
├── hooks/
│   └── useWeekNavigation.hook.tsx       # Custom hook for week logic
├── models/
│   └── week-selector.model.ts           # TypeScript interfaces
├── utils/
│   └── week-selector.utils.ts           # Date utility functions
└── index.ts                             # Barrel exports
```

### 3. Server vs Client Component Strategy

**All Client Components** approach for optimal Next.js performance:

- **WeekSelector**: Client Component (user interactions, state management)
- **DayTile**: Client Component (click handlers, hover effects)
- **useWeekNavigation**: Client-side hook (state management, navigation)

**Why Client Components Only?**
1. User interactions require client-side event handlers
2. State management for week navigation needs client-side hooks
3. Visual feedback (hover, selected states) requires client-side rendering
4. No server-side data fetching needed (dates are calculated client-side)

### 4. State Management Patterns for Next.js

#### Primary State Management: React useState + Custom Hook

```typescript
// hooks/useWeekNavigation.hook.tsx
"use client";

export function useWeekNavigation(initialDate: string) {
  // Local state for week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    startOfWeek(parseISO(initialDate), { weekStartsOn: 1 })
  );

  const [isNavigating, setIsNavigating] = useState(false);

  // Derived state with useMemo for performance
  const currentWeek = useMemo(() =>
    eachDayOfInterval({
      start: currentWeekStart,
      end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
    }),
    [currentWeekStart]
  );

  // Navigation functions
  const navigateToNextWeek = useCallback(() => {
    setIsNavigating(true);
    setCurrentWeekStart(prev => addWeeks(prev, 1));
    setTimeout(() => setIsNavigating(false), 150);
  }, []);

  return {
    currentWeek,
    weekRange,
    navigateToNextWeek,
    navigateToPrevWeek,
    navigateToWeek,
    isNavigating
  };
}
```

#### Integration with Existing Booking State

```typescript
// week-selector.component.tsx
export function WeekSelector({ selectedDate, onDateChange }: WeekSelectorProps) {
  const { currentWeek, weekRange, navigateToNextWeek, navigateToPrevWeek } =
    useWeekNavigation(selectedDate);

  const handleDayClick = useCallback((date: Date) => {
    // Convert to YYYY-MM-DD format using existing utilities
    const formattedDate = format(date, 'yyyy-MM-dd');
    onDateChange(formattedDate);
  }, [onDateChange]);

  // Component renders here...
}
```

### 5. Performance Optimization Strategies for Next.js

#### 5.1 Memoization Strategy

```typescript
// Memoize expensive calculations
const currentWeek = useMemo(() =>
  eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
  }),
  [currentWeekStart]
);

const weekRange = useMemo(() => {
  const start = format(currentWeek[0], 'd MMM', { locale: es });
  const end = format(currentWeek[6], 'd MMM', { locale: es });
  return `${start} - ${end}`;
}, [currentWeek]);

// Memoize day tiles to prevent unnecessary re-renders
const dayTiles = useMemo(() =>
  currentWeek.map((date, index) => (
    <DayTile
      key={date.toISOString()}
      date={date}
      isSelected={isSameDay(date, selectedDateObj)}
      isToday={isSameDay(date, new Date())}
      isDisabled={isDateDisabled(date)}
      onClick={handleDayClick}
    />
  )),
  [currentWeek, selectedDateObj, handleDayClick]
);
```

#### 5.2 Callback Optimization

```typescript
// Stable callback references
const handleDayClick = useCallback((date: Date) => {
  const formattedDate = format(date, 'yyyy-MM-dd');
  onDateChange(formattedDate);
}, [onDateChange]);

const navigateToNextWeek = useCallback(() => {
  setIsNavigating(true);
  setCurrentWeekStart(prev => addWeeks(prev, 1));
  // Debounce navigation state reset
  setTimeout(() => setIsNavigating(false), 150);
}, []);
```

#### 5.3 Bundle Optimization

```typescript
// Tree-shaking friendly imports
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  parseISO,
  isSameDay,
  addWeeks,
  subWeeks
} from 'date-fns';
import { es } from 'date-fns/locale';

// Import only required Lucide icons
import { ChevronLeft, ChevronRight } from 'lucide-react';
```

### 6. Import/Export Patterns Following Project Conventions

#### 6.1 Barrel Exports (index.ts)

```typescript
// modules/booking/pods/booking-dashboard/components/week-selector/index.ts
export { WeekSelector } from './week-selector.component';
export { DayTile } from './day-tile.component';
export { useWeekNavigation } from './hooks/useWeekNavigation.hook';
export type {
  WeekSelectorProps,
  DayTileProps,
  UseWeekNavigationReturn
} from './models/week-selector.model';
```

#### 6.2 Component Import Pattern

```typescript
// In booking-dashboard.component.tsx
import { WeekSelector } from "./components/week-selector";
// OR (more explicit)
import { WeekSelector } from "./components/week-selector/week-selector.component";
```

#### 6.3 Shared Assets Import Pattern

```typescript
// Check shared assets first (project mandate)
import { Button } from "@/common/ui/button";           // Project's button
import { cn } from "@/lib/utils";                      // Utility function
import { BookingUtils } from "../../utils/booking.utils"; // Existing utilities
```

### 7. Integration Approach with Existing Booking System

#### 7.1 Coexistence Strategy (Recommended)

Both components will coexist for maximum compatibility:

```typescript
// In booking-dashboard.component.tsx (lines 88-106)
<div className="flex items-center gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => refetch()}
    disabled={isLoading}
    className="flex items-center gap-2"
  >
    <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
    Actualizar
  </Button>

  {/* Existing date input - KEEP */}
  <input
    type="date"
    value={bookingDay?.date || ""}
    onChange={(e) => handleDateChange(e.target.value)}
    className="px-3 py-2 border rounded-md text-sm"
  />

  {/* NEW: WeekSelector - AUTOMATIC SYNC */}
  <WeekSelector
    selectedDate={bookingDay?.date || ""}
    onDateChange={handleDateChange}
    className="w-auto"
    disabled={isLoading}
  />
</div>
```

#### 7.2 Synchronization Benefits

- **Automatic Sync**: Both components use same `handleDateChange` callback
- **No Additional Logic**: React state management handles synchronization
- **Backward Compatibility**: Existing functionality preserved
- **User Choice**: Users can use either input method

### 8. Next.js Specific Considerations for Date Handling

#### 8.1 Hydration Considerations

```typescript
// Prevent hydration mismatches for date-sensitive calculations
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

if (!isMounted) {
  // Return loading state or null during SSR
  return <div className="week-selector-skeleton">Loading...</div>;
}
```

#### 8.2 Timezone Handling

```typescript
// Use consistent timezone handling
const today = useMemo(() => {
  // Ensure consistent "today" calculation
  return startOfDay(new Date());
}, []);

const isToday = useCallback((date: Date) => {
  return isSameDay(date, today);
}, [today]);
```

#### 8.3 Server-Side Rendering Compatibility

Since all components are Client Components, SSR concerns are minimal, but ensure:

```typescript
// Avoid window/document references in module scope
const WeekSelector = ({ selectedDate, onDateChange }: WeekSelectorProps) => {
  // All browser-specific logic inside component body
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // Safe date initialization
    const initialDate = selectedDate ? parseISO(selectedDate) : new Date();
    return startOfWeek(initialDate, { weekStartsOn: 1 });
  });
};
```

### 9. TypeScript Interfaces Following Project Patterns

#### 9.1 Component Props Interfaces

```typescript
// models/week-selector.model.ts
export interface WeekSelectorProps {
  /** Currently selected date in YYYY-MM-DD format */
  selectedDate: string;
  /** Callback when date changes - Compatible with existing handleDateChange */
  onDateChange: (date: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Disable the entire component */
  disabled?: boolean;
  /** Minimum selectable date in YYYY-MM-DD format */
  minDate?: string;
  /** Maximum selectable date in YYYY-MM-DD format */
  maxDate?: string;
}

export interface DayTileProps {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
  onClick: (date: Date) => void;
  className?: string;
}

export interface UseWeekNavigationReturn {
  currentWeek: Date[];
  weekRange: string;
  navigateToNextWeek: () => void;
  navigateToPrevWeek: () => void;
  navigateToWeek: (date: Date) => void;
  isNavigating: boolean;
}
```

### 10. Component Implementation Templates

#### 10.1 Main WeekSelector Component

```typescript
// week-selector.component.tsx
"use client";

import { Button } from "@/common/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCallback, useMemo } from 'react';

import { WeekSelectorProps } from './models/week-selector.model';
import { useWeekNavigation } from './hooks/useWeekNavigation.hook';
import { DayTile } from './day-tile.component';
import { WeekSelectorUtils } from './utils/week-selector.utils';

export function WeekSelector({
  selectedDate,
  onDateChange,
  className,
  disabled = false,
  minDate,
  maxDate
}: WeekSelectorProps) {
  const selectedDateObj = useMemo(() =>
    selectedDate ? parseISO(selectedDate) : new Date(),
    [selectedDate]
  );

  const {
    currentWeek,
    weekRange,
    navigateToNextWeek,
    navigateToPrevWeek,
    isNavigating
  } = useWeekNavigation(selectedDate);

  const handleDayClick = useCallback((date: Date) => {
    if (disabled) return;

    const formattedDate = format(date, 'yyyy-MM-dd');
    onDateChange(formattedDate);
  }, [onDateChange, disabled]);

  const isDateDisabled = useCallback((date: Date) => {
    if (disabled) return true;

    const dateStr = format(date, 'yyyy-MM-dd');

    if (minDate && dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;

    return false;
  }, [disabled, minDate, maxDate]);

  return (
    <div
      className={cn("week-selector", className)}
      role="group"
      aria-label="Selector semanal de fechas"
    >
      {/* Week navigation header */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={navigateToPrevWeek}
          disabled={disabled || isNavigating}
          aria-label="Semana anterior"
          aria-describedby="week-range-display"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span
          id="week-range-display"
          className="text-sm font-medium"
          aria-live="polite"
        >
          {weekRange}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={navigateToNextWeek}
          disabled={disabled || isNavigating}
          aria-label="Semana siguiente"
          aria-describedby="week-range-display"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day tiles grid */}
      <div className="grid grid-cols-7 gap-1" role="grid">
        {currentWeek.map((date) => (
          <DayTile
            key={date.toISOString()}
            date={date}
            isSelected={isSameDay(date, selectedDateObj)}
            isToday={isSameDay(date, new Date())}
            isDisabled={isDateDisabled(date)}
            onClick={handleDayClick}
          />
        ))}
      </div>
    </div>
  );
}
```

#### 10.2 DayTile Component

```typescript
// day-tile.component.tsx
"use client";

import { Button } from "@/common/ui/button";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { DayTileProps } from './models/week-selector.model';

export function DayTile({
  date,
  isSelected,
  isToday,
  isDisabled,
  onClick,
  className
}: DayTileProps) {
  const dayAbbr = format(date, 'E', { locale: es }); // lun, mar, etc.
  const dayNumber = format(date, 'd');
  const fullDate = format(date, 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: es });

  return (
    <Button
      variant={isSelected ? "default" : "ghost"}
      size="sm"
      disabled={isDisabled}
      onClick={() => onClick(date)}
      className={cn(
        "flex flex-col p-2 h-auto min-h-[60px] transition-all",
        isToday && !isSelected && "border border-primary",
        isSelected && "bg-primary text-primary-foreground",
        className
      )}
      role="gridcell"
      aria-label={fullDate}
      aria-selected={isSelected}
      aria-current={isToday ? "date" : undefined}
    >
      <span className="text-xs font-normal opacity-70">
        {dayAbbr}
      </span>
      <span className="text-lg font-semibold">
        {dayNumber}
      </span>
    </Button>
  );
}
```

### 11. Testing Considerations for Next.js

#### 11.1 Component Testing Strategy

```typescript
// week-selector.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeekSelector } from './week-selector.component';

describe('WeekSelector', () => {
  const mockOnDateChange = vi.fn();

  const defaultProps = {
    selectedDate: '2024-01-15',
    onDateChange: mockOnDateChange,
  };

  beforeEach(() => {
    mockOnDateChange.mockClear();
  });

  describe('unit tests', () => {
    it('should render week selector with current week', () => {
      render(<WeekSelector {...defaultProps} />);

      expect(screen.getByRole('group', { name: /selector semanal/i })).toBeInTheDocument();
      expect(screen.getByText(/15 ene - 21 ene/i)).toBeInTheDocument();
    });

    it('should call onDateChange when day is clicked', () => {
      render(<WeekSelector {...defaultProps} />);

      const dayButton = screen.getByRole('gridcell', { name: /martes/i });
      fireEvent.click(dayButton);

      expect(mockOnDateChange).toHaveBeenCalledWith('2024-01-16');
    });
  });

  describe('integration tests', () => {
    it('should integrate with booking dashboard handleDateChange', () => {
      const handleDateChange = vi.fn();

      render(
        <WeekSelector
          selectedDate="2024-01-15"
          onDateChange={handleDateChange}
        />
      );

      const nextWeekButton = screen.getByLabelText(/semana siguiente/i);
      fireEvent.click(nextWeekButton);

      const newDayButton = screen.getByRole('gridcell', { name: /lunes, 22/i });
      fireEvent.click(newDayButton);

      expect(handleDateChange).toHaveBeenCalledWith('2024-01-22');
    });
  });

  describe('accessibility tests', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<WeekSelector {...defaultProps} />);

      expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Selector semanal de fechas');
      expect(screen.getByRole('grid')).toBeInTheDocument();
      expect(screen.getAllByRole('gridcell')).toHaveLength(7);
    });
  });
});
```

### 12. Performance Benchmarks and Bundle Impact

#### 12.1 Expected Bundle Impact
- **Component Size**: ~2-3KB gzipped
- **Dependencies**: No additional dependencies (uses existing date-fns, lucide-react)
- **Tree Shaking**: Optimized imports reduce bundle size
- **Runtime Performance**: Minimal impact (memoized calculations)

#### 12.2 Performance Optimizations Applied
- **Memoization**: All expensive calculations memoized
- **Callback Stability**: useCallback for all event handlers
- **Render Optimization**: Minimal re-renders through careful state management
- **Tree Shaking**: Selective imports from large libraries

### 13. Migration and Deployment Strategy

#### 13.1 Implementation Phases

**Phase 1: Core Component Development**
1. Create WeekSelector component structure
2. Implement DayTile subcomponent
3. Create useWeekNavigation hook
4. Add utility functions and TypeScript interfaces

**Phase 2: Integration and Testing**
1. Add WeekSelector alongside existing date input
2. Verify bidirectional synchronization
3. Implement comprehensive test suite
4. Accessibility audit and fixes

**Phase 3: Quality Assurance and Performance**
1. Bundle size analysis and optimization
2. Performance testing and profiling
3. User acceptance testing
4. Final optimizations and refinements

#### 13.2 Rollback Strategy
- **Zero Risk**: Original date input remains functional
- **Feature Flag**: Easy to disable WeekSelector if needed
- **Gradual Rollout**: Can be tested with specific user groups

### 14. Future Enhancement Opportunities

#### 14.1 Short-term Enhancements
- **Animations**: Smooth week transitions
- **Touch Gestures**: Swipe navigation for mobile
- **Keyboard Shortcuts**: Advanced keyboard navigation

#### 14.2 Long-term Enhancements
- **Month View**: Expandable month calendar
- **Booking Indicators**: Visual availability indicators per day
- **Custom Themes**: Additional visual customization options

## Conclusion

This implementation plan provides a robust, performant, and maintainable Next.js architecture for the WeekSelector component. The design follows all project conventions, maintains backward compatibility, and provides significant UX improvements while keeping bundle size minimal and performance optimal.

The component integrates seamlessly with the existing booking system through the coexistence strategy, ensuring zero disruption to current functionality while providing users with an enhanced date selection experience.

## Key Implementation Notes

1. **All Client Components**: Optimal for user interactions and state management
2. **Coexistence Strategy**: Zero risk deployment alongside existing date input
3. **Performance Optimized**: Memoization and callback optimization throughout
4. **Accessibility First**: Full ARIA compliance and keyboard navigation
5. **Type Safety**: Comprehensive TypeScript interfaces following project patterns
6. **Testing Ready**: Comprehensive test strategy with 80% coverage target
7. **Bundle Optimized**: Tree-shaking friendly imports and minimal footprint

## Things to Clarify with User

### Technical Clarifications Needed

1. **Date Range Constraints**: Are there specific business rules for minimum/maximum selectable dates that should be enforced in the WeekSelector?

2. **Mobile Behavior**: Should the WeekSelector have special behavior on mobile devices (e.g., horizontal scrolling, touch gestures) or is the standard responsive grid sufficient?

3. **Calendar Weeks**: Should the week start on Monday (current implementation) or Sunday? This affects the `weekStartsOn` parameter.

4. **Disabled Dates**: Are there specific dates that should be disabled (e.g., past dates, holidays, maintenance days) beyond the min/max date constraints?

5. **Integration Priority**: Should the WeekSelector eventually replace the date input entirely, or is the coexistence approach the long-term solution?

6. **Performance Requirements**: Are there specific performance requirements for the component (e.g., first paint time, interaction responsiveness)?

### UX/Design Clarifications Needed

1. **Visual Design**: Should the WeekSelector follow the exact visual design from the provided image, or are there brand-specific styling requirements?

2. **Responsive Breakpoints**: At what screen sizes should the component adapt its layout (e.g., smaller day tiles on mobile)?

3. **Loading States**: How should the component handle loading states when the booking data is being fetched?

4. **Error Handling**: How should date selection errors be communicated to users (e.g., when selecting unavailable dates)?

5. **Animation Preferences**: Are smooth transitions between weeks desired, or should the component prioritize immediate responsiveness?

### Business Logic Clarifications Needed

1. **Booking Availability**: Should the WeekSelector visually indicate which days have available bookings vs. full days?

2. **User Permissions**: Are there user role-based restrictions on date selection that should be enforced?

3. **Time Zone Handling**: How should the component handle users in different time zones, especially for "today" calculations?

4. **Data Refresh**: Should date changes trigger immediate booking data refresh, or rely on the existing refresh mechanism?

These clarifications will help ensure the implementation meets all business requirements and provides the optimal user experience.