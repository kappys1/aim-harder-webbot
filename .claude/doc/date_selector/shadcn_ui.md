# Weekly Date Selector Component - shadcn/ui Implementation Plan

## Executive Summary

This document outlines the implementation plan for replacing the basic HTML date input in the booking dashboard with a sophisticated weekly date selector component using shadcn/ui components. The component will provide an intuitive weekly navigation interface with day tiles, week range display, and accessibility features.

## Current System Analysis

### Integration Points
- **Location**: `modules/booking/pods/booking-dashboard/booking-dashboard.component.tsx:100-106`
- **Current Implementation**: Basic HTML `<input type="date">`
- **Callback**: `handleDateChange(date: string)` function
- **State Management**: `useBooking` hook with `setDate` function
- **Date Format**: YYYY-MM-DD string format via `bookingDay?.date`
- **Existing Utilities**: `BookingUtils.formatDate()` with date-fns and Spanish locale

### Data Models
- `BookingDay.date`: string in YYYY-MM-DD format
- Date formatting handled by `BookingUtils` class with date-fns library
- Spanish locale support (es) already configured

## Component Architecture

### 1. Main Component: WeekSelector

**File**: `modules/booking/pods/booking-dashboard/components/week-selector/week-selector.component.tsx`

```typescript
interface WeekSelectorProps {
  selectedDate: string; // YYYY-MM-DD format
  onDateChange: (date: string) => void;
  className?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
}

interface WeekSelectorState {
  currentWeekStart: Date;
  selectedDate: Date;
  isNavigating: boolean;
}
```

### 2. Subcomponent: DayTile

**File**: `modules/booking/pods/booking-dashboard/components/week-selector/day-tile.component.tsx`

```typescript
interface DayTileProps {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
  onClick: (date: Date) => void;
  className?: string;
}
```

### 3. Hooks

**File**: `modules/booking/pods/booking-dashboard/components/week-selector/hooks/useWeekNavigation.hook.tsx`

```typescript
interface UseWeekNavigationReturn {
  currentWeek: Date[];
  weekRange: string;
  navigateToNextWeek: () => void;
  navigateToPrevWeek: () => void;
  navigateToWeek: (date: Date) => void;
  isNavigating: boolean;
}
```

## shadcn/ui Components Usage

### 1. Button Component
- **Navigation arrows**: Previous/Next week buttons
- **Day tiles**: Individual day buttons
- **Variants**:
  - `ghost` for navigation arrows
  - `default` for selected day
  - `outline` for unselected days

### 2. Card Component (Optional)
- **Container**: Main week selector wrapper
- **Variant**: Subtle border and shadow for better visual separation

### 3. Badge Component (Alternative)
- **Day numbers**: Could be used for day number display in tiles
- **Variant**: `outline` for better integration

## Component Structure & Implementation

### WeekSelector Component Structure

```typescript
export function WeekSelector({
  selectedDate,
  onDateChange,
  className,
  disabled = false,
  minDate,
  maxDate
}: WeekSelectorProps) {
  // State management
  // Week navigation logic
  // Event handlers

  return (
    <div className={cn("week-selector", className)}>
      {/* Week navigation header */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={navigateToPrevWeek}
          disabled={disabled || isNavigating}
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm font-medium">
          {weekRange}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={navigateToNextWeek}
          disabled={disabled || isNavigating}
          aria-label="Semana siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day tiles grid */}
      <div className="grid grid-cols-7 gap-1">
        {currentWeek.map((date, index) => (
          <DayTile
            key={date.toISOString()}
            date={date}
            isSelected={isSameDay(date, selectedDate)}
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

### DayTile Component Structure

```typescript
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

  return (
    <Button
      variant={isSelected ? "default" : "ghost"}
      size="sm"
      disabled={isDisabled}
      onClick={() => onClick(date)}
      className={cn(
        "flex flex-col p-2 h-auto min-h-[60px]",
        isToday && !isSelected && "border border-primary",
        isSelected && "bg-primary text-primary-foreground",
        className
      )}
      aria-label={`${dayAbbr}, ${dayNumber} de ${format(date, 'MMMM', { locale: es })}`}
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

## Styling Approach

### TailwindCSS Classes

```css
/* Week Selector Container */
.week-selector {
  @apply w-full max-w-md;
}

/* Week Range Display */
.week-range {
  @apply text-sm font-medium text-foreground;
}

/* Day Tile Grid */
.day-tiles-grid {
  @apply grid grid-cols-7 gap-1;
}

/* Day Tile States */
.day-tile-base {
  @apply flex flex-col items-center justify-center p-2 h-auto min-h-[60px] transition-all;
}

.day-tile-selected {
  @apply bg-primary text-primary-foreground;
}

.day-tile-today {
  @apply border border-primary;
}

.day-tile-disabled {
  @apply opacity-50 cursor-not-allowed;
}

/* Responsive Design */
@media (max-width: 640px) {
  .week-selector {
    @apply max-w-full;
  }

  .day-tile-base {
    @apply min-h-[50px] p-1;
  }
}
```

### Color Scheme (from @src/index.css)
- **Primary**: For selected day background
- **Foreground**: For text colors
- **Muted-foreground**: For day abbreviations
- **Border**: For today indicator

## Props Interface & State Management

### WeekSelector Props

```typescript
interface WeekSelectorProps {
  /** Currently selected date in YYYY-MM-DD format */
  selectedDate: string;

  /** Callback when date changes */
  onDateChange: (date: string) => void;

  /** Additional CSS classes */
  className?: string;

  /** Disable the entire component */
  disabled?: boolean;

  /** Minimum selectable date */
  minDate?: string;

  /** Maximum selectable date */
  maxDate?: string;

  /** Show week numbers */
  showWeekNumbers?: boolean;

  /** Custom week start day (0 = Sunday, 1 = Monday) */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
```

### State Management Strategy

```typescript
// Internal state for week navigation
const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
  startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 })
);

const [isNavigating, setIsNavigating] = useState(false);

// Derived state
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
```

## Accessibility Considerations

### ARIA Labels and Roles

```typescript
// Week selector container
<div
  role="group"
  aria-label="Selector semanal de fechas"
  className="week-selector"
>

// Navigation buttons
<Button
  aria-label="Semana anterior"
  aria-describedby="week-range-display"
>

<Button
  aria-label="Semana siguiente"
  aria-describedby="week-range-display"
>

// Week range display
<span
  id="week-range-display"
  aria-live="polite"
  className="week-range"
>

// Day tiles
<Button
  role="gridcell"
  aria-label={`${dayAbbr}, ${dayNumber} de ${format(date, 'MMMM', { locale: es })}`}
  aria-selected={isSelected}
  aria-current={isToday ? "date" : undefined}
>
```

### Keyboard Navigation

```typescript
// Support for arrow key navigation
const handleKeyDown = useCallback((event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      navigateToPreviousDay();
      break;
    case 'ArrowRight':
      event.preventDefault();
      navigateToNextDay();
      break;
    case 'ArrowUp':
      event.preventDefault();
      navigateToPrevWeek();
      break;
    case 'ArrowDown':
      event.preventDefault();
      navigateToNextWeek();
      break;
    case 'Home':
      event.preventDefault();
      navigateToFirstDayOfWeek();
      break;
    case 'End':
      event.preventDefault();
      navigateToLastDayOfWeek();
      break;
    case 'Space':
    case 'Enter':
      event.preventDefault();
      selectCurrentDay();
      break;
  }
}, []);
```

### Screen Reader Support

- **Live regions**: Week range updates announced via `aria-live="polite"`
- **Descriptive labels**: Full date descriptions for each day tile
- **State announcements**: Selected and current day states clearly indicated
- **Navigation hints**: Instructions for keyboard users

## Integration Requirements

### 1. Add WeekSelector Alongside Current Date Input

**In**: `booking-dashboard.component.tsx`

```typescript
// Current structure (lines 88-106):
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

  {/* Existing date input - keep as is */}
  <input
    type="date"
    value={bookingDay?.date || ""}
    onChange={(e) => handleDateChange(e.target.value)}
    className="px-3 py-2 border rounded-md text-sm"
  />

  {/* NEW: Add WeekSelector component - synchronized */}
  <WeekSelector
    selectedDate={bookingDay?.date || ""}
    onDateChange={handleDateChange}
    className="w-auto"
    disabled={isLoading}
  />
</div>
```

### 2. Import Statements

```typescript
import { WeekSelector } from "./components/week-selector/week-selector.component";
```

### 3. Dependencies

```typescript
// Required date-fns functions (already available)
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

// Required icons (from lucide-react)
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Required shadcn components
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

## File Structure

```
modules/booking/pods/booking-dashboard/components/week-selector/
├── week-selector.component.tsx          # Main component
├── day-tile.component.tsx               # Day tile subcomponent
├── hooks/
│   └── useWeekNavigation.hook.tsx       # Week navigation logic
├── utils/
│   └── week-selector.utils.ts           # Helper functions
└── index.ts                             # Barrel exports
```

## Testing Considerations

### Unit Tests Required

1. **Date Navigation Logic**
   - Week navigation (prev/next)
   - Day selection
   - Date validation

2. **Accessibility**
   - ARIA labels
   - Keyboard navigation
   - Screen reader announcements

3. **Integration**
   - Callback invocation
   - Date format conversion
   - Loading/disabled states

### Test Cases

```typescript
describe('WeekSelector', () => {
  it('should display current week correctly');
  it('should navigate to next week');
  it('should navigate to previous week');
  it('should select day on click');
  it('should respect min/max date constraints');
  it('should handle keyboard navigation');
  it('should announce changes to screen readers');
  it('should integrate with booking dashboard');
});
```

## Performance Considerations

### Optimizations

1. **Memoization**: Week calculations and date formatting
2. **Lazy Loading**: Component code splitting if needed
3. **Event Debouncing**: Navigation button clicks
4. **Virtual Scrolling**: Not applicable for 7-day grid

### Bundle Impact

- **Minimal**: Uses existing dependencies (date-fns, shadcn/ui)
- **Tree Shaking**: Only required date-fns functions imported
- **Gzip Size**: Estimated ~2KB additional bundle size

## Migration Strategy

### Phase 1: Component Development
1. Create WeekSelector component
2. Create DayTile subcomponent
3. Implement hooks and utilities
4. Add comprehensive tests

### Phase 2: Integration (Coexistence Approach)
1. **Add WeekSelector alongside existing date input** (both components coexist)
2. **Ensure bidirectional synchronization** - changes in either component update both
3. **Test dual-component integration** with booking system
4. **Verify date format compatibility** for both components
5. **Ensure accessibility compliance** for both input methods

### Phase 3: Enhancement
1. Add animations/transitions
2. Implement advanced keyboard shortcuts
3. Add custom theming support
4. Performance optimization
5. **Optional**: Add toggle to show/hide either component based on user preference

## Potential Challenges & Solutions

### 1. Date Format Consistency
**Challenge**: Ensuring YYYY-MM-DD format compatibility
**Solution**: Use BookingUtils.formatDateForApi() for conversions

### 2. Locale Support
**Challenge**: Spanish locale for day abbreviations
**Solution**: Leverage existing date-fns Spanish locale configuration

### 3. Responsive Design
**Challenge**: 7-day grid on mobile devices + coexistence with date input
**Solution**:
- Stack components vertically on mobile
- Horizontal scrolling with touch gestures for WeekSelector
- Smaller tile sizes for compact layout

### 4. Accessibility Compliance
**Challenge**: Complex navigation patterns + dual input methods
**Solution**:
- Follow ARIA authoring practices, extensive keyboard support
- Clear labeling to distinguish between input methods
- Ensure screen readers announce both options

### 5. Component Synchronization
**Challenge**: Keeping both components in sync when either changes
**Solution**:
- Both components use the same `handleDateChange` callback
- React's state management ensures automatic synchronization
- No additional sync logic needed

## Future Enhancements

### Short Term
- Smooth transitions between weeks
- Touch/swipe gestures for mobile
- Custom date range selection

### Long Term
- Month view integration
- Holiday highlighting
- Booking availability indicators per day
- Multi-language support

## Conclusion

The WeekSelector component will provide a modern, accessible, and intuitive replacement for the basic date input. By leveraging shadcn/ui components and following established patterns, the implementation will integrate seamlessly with the existing booking system while providing an enhanced user experience.

The component maintains full compatibility with the current booking infrastructure while adding significant value through improved usability, accessibility, and visual design.