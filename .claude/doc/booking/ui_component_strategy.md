# UI Component Design Strategy for Booking System

## Overview

This document outlines the comprehensive UI component design strategy for the CrossFit booking system, following the established shadcn-ui patterns and ensuring mobile-first responsive design with accessibility as a core principle.

## 1. Design System Analysis

### 1.1 Existing Patterns Observed

**Button Component Patterns:**
- Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- Sizes: `default` (h-9), `sm` (h-8), `lg` (h-10), `icon` (size-9)
- Focus-visible ring patterns with proper contrast
- SVG handling with consistent sizing

**Form Component Patterns:**
- Larger touch targets (h-12) for mobile usability
- Consistent gap spacing (gap-6, gap-3)
- Proper label association and accessibility
- Loading states with disabled styling
- Error display with destructive color scheme

**Layout Patterns:**
- Grid-based layouts with consistent spacing
- Mobile-first responsive design
- Proper semantic HTML structure
- Use of `cn()` utility for conditional styling

### 1.2 Color System and Theming
```typescript
// Observed color patterns from existing components
const colorTokens = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  accent: "hover:bg-accent hover:text-accent-foreground",
  muted: "text-muted-foreground",
  background: "bg-background",
  border: "border",
  ring: "focus-visible:ring-ring/50",
};
```

## 2. Component Architecture Strategy

### 2.1 Component Hierarchy

```
BookingDashboard
├── BookingHeader
│   ├── BoxSelector
│   ├── DatePicker
│   └── RefreshButton
├── BookingFilters
│   ├── ClassTypeFilter
│   ├── TimeFilter
│   └── CapacityFilter
├── BookingGrid
│   ├── BookingCard (multiple)
│   │   ├── BookingTime
│   │   ├── BookingInfo
│   │   ├── CapacityIndicator
│   │   ├── CoachInfo
│   │   └── BookingActions
│   └── EmptyState
└── BookingActions
    ├── BookingModal
    ├── WaitlistModal
    └── ConfirmationToast
```

### 2.2 Core Component Specifications

#### 2.2.1 BookingCard Component

```typescript
// modules/booking/pods/booking-dashboard/components/booking-card/booking-card.component.tsx
"use client";

import { cn } from "@/common/lib/utils";
import { Button } from "@/common/ui/button";
import { Badge } from "@/common/ui/badge";
import { Card, CardContent, CardHeader } from "@/common/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/common/ui/avatar";
import { Clock, Users, UserCheck, AlertCircle } from "lucide-react";
import { BookingCardProps, BookingAction } from "./booking-card.types";

export function BookingCard({
  booking,
  action,
  isActionPending,
  onAction,
  className,
  ...props
}: BookingCardProps) {
  const capacityPercentage = (booking.ocupation / booking.limit) * 100;

  const getCapacityColor = () => {
    if (capacityPercentage >= 100) return "destructive";
    if (capacityPercentage >= 80) return "warning";
    if (capacityPercentage >= 60) return "secondary";
    return "default";
  };

  const getStatusIcon = () => {
    if (booking.bookState) return <UserCheck className="h-4 w-4" />;
    if (capacityPercentage >= 100) return <AlertCircle className="h-4 w-4" />;
    return <Users className="h-4 w-4" />;
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        "hover:shadow-md hover:shadow-black/5",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        booking.bookState && "ring-2 ring-primary/20 bg-primary/5",
        !booking.enabled && "opacity-60",
        className
      )}
      {...props}
    >
      {/* Class type indicator stripe */}
      <div
        className="absolute top-0 left-0 w-1 h-full"
        style={{ backgroundColor: booking.color }}
        aria-hidden="true"
      />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <time
                className="font-semibold text-base"
                dateTime={booking.time}
              >
                {booking.displayTime}
              </time>
            </div>

            <h3 className="font-medium text-foreground truncate">
              {booking.className}
            </h3>

            {booking.coachName && (
              <p className="text-sm text-muted-foreground">
                with {booking.coachName}
              </p>
            )}
          </div>

          <Badge
            variant={getCapacityColor()}
            className="flex items-center gap-1 flex-shrink-0"
          >
            {getStatusIcon()}
            <span className="sr-only">Capacity:</span>
            {booking.ocupation}/{booking.limit}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Capacity Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Capacity</span>
              <span>{Math.round(capacityPercentage)}% full</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  capacityPercentage >= 100 && "bg-destructive",
                  capacityPercentage >= 80 && capacityPercentage < 100 && "bg-warning",
                  capacityPercentage >= 60 && capacityPercentage < 80 && "bg-secondary",
                  capacityPercentage < 60 && "bg-primary"
                )}
                style={{ width: `${Math.min(100, capacityPercentage)}%` }}
                role="progressbar"
                aria-valuenow={booking.ocupation}
                aria-valuemax={booking.limit}
                aria-label={`Class capacity: ${booking.ocupation} of ${booking.limit} spots filled`}
              />
            </div>
          </div>

          {/* Waitlist indicator */}
          {booking.waitlist > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>{booking.waitlist} on waitlist</span>
            </div>
          )}

          {/* Coach avatar and info */}
          {booking.coachName && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={booking.coachPic} alt={booking.coachName} />
                <AvatarFallback className="text-xs">
                  {booking.coachName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {booking.coachName}
              </span>
            </div>
          )}

          {/* Action Button */}
          <BookingActionButton
            action={action}
            isLoading={isActionPending}
            onAction={() => onAction(booking, action.type)}
            disabled={!action.available}
            className="w-full h-9"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Action button sub-component
function BookingActionButton({
  action,
  isLoading,
  onAction,
  disabled,
  className
}: BookingActionButtonProps) {
  const getButtonVariant = (): ButtonVariant => {
    switch (action.priority) {
      case 'primary': return 'default';
      case 'secondary': return 'outline';
      case 'destructive': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Button
      variant={getButtonVariant()}
      size="sm"
      onClick={onAction}
      disabled={disabled || isLoading}
      className={cn(className)}
      aria-describedby={action.reason ? `action-reason-${action.type}` : undefined}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="sr-only">Processing...</span>
          <span aria-hidden="true">...</span>
        </>
      ) : (
        action.label
      )}

      {action.reason && (
        <span id={`action-reason-${action.type}`} className="sr-only">
          {action.reason}
        </span>
      )}
    </Button>
  );
}
```

#### 2.2.2 Mobile-Optimized Grid Component

```typescript
// modules/booking/pods/booking-dashboard/components/booking-grid/booking-grid.component.tsx
"use client";

import { cn } from "@/common/lib/utils";
import { BookingCard } from "../booking-card/booking-card.component";
import { BookingGridProps } from "./booking-grid.types";
import { EmptyState } from "../empty-state/empty-state.component";
import { VirtualizedList } from "@/common/components/virtualized-list";
import { useMediaQuery } from "@/common/hooks/use-media-query";

export function BookingGrid({
  bookings,
  onBookingAction,
  isActionPending,
  getBookingAction,
  user,
  className,
  ...props
}: BookingGridProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (bookings.length === 0) {
    return <EmptyState />;
  }

  // Mobile: Use virtualized list for performance
  if (isMobile) {
    return (
      <div className={cn("booking-grid-mobile", className)} {...props}>
        <VirtualizedList
          items={bookings}
          renderItem={({ item: booking, index }) => (
            <div key={booking.id} className="pb-4">
              <BookingCard
                booking={booking}
                action={getBookingAction(booking, user)}
                isActionPending={isActionPending(booking.id)}
                onAction={onBookingAction}
              />
            </div>
          )}
          itemHeight={200} // Approximate card height
          className="space-y-4"
        />
      </div>
    );
  }

  // Desktop: Regular grid layout
  return (
    <div
      className={cn(
        "grid gap-4",
        "sm:grid-cols-1",
        "md:grid-cols-2",
        "lg:grid-cols-3",
        "xl:grid-cols-4",
        className
      )}
      {...props}
    >
      {bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          action={getBookingAction(booking, user)}
          isActionPending={isActionPending(booking.id)}
          onAction={onBookingAction}
        />
      ))}
    </div>
  );
}
```

#### 2.2.3 Date Picker Component

```typescript
// modules/booking/pods/booking-dashboard/components/date-picker/date-picker.component.tsx
"use client";

import { cn } from "@/common/lib/utils";
import { Button } from "@/common/ui/button";
import { Calendar } from "@/common/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/common/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, isToday, isTomorrow } from "date-fns";
import { useState } from "react";

export function DatePicker({
  selectedDate,
  onDateChange,
  className,
  ...props
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentDate = new Date(selectedDate);

  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM d");
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev'
      ? subDays(currentDate, 1)
      : addDays(currentDate, 1);

    onDateChange(format(newDate, 'yyyyMMdd'));
  };

  return (
    <div className={cn("flex items-center gap-1", className)} {...props}>
      {/* Previous day button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigateDate('prev')}
        aria-label="Previous day"
        className="h-9 w-9 flex-shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Date display with calendar popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="min-w-[120px] justify-between gap-2 h-9"
            aria-expanded={isOpen}
            aria-haspopup="dialog"
          >
            <span className="font-medium">
              {getDateLabel(currentDate)}
            </span>
            <CalendarIcon className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          side="bottom"
        >
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={(date) => {
              if (date) {
                onDateChange(format(date, 'yyyyMMdd'));
                setIsOpen(false);
              }
            }}
            disabled={(date) => {
              // Disable past dates
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return date < today;
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Next day button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigateDate('next')}
        aria-label="Next day"
        className="h-9 w-9 flex-shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

#### 2.2.4 Capacity Indicator Component

```typescript
// modules/booking/pods/booking-dashboard/components/capacity-indicator/capacity-indicator.component.tsx
"use client";

import { cn } from "@/common/lib/utils";
import { Progress } from "@/common/ui/progress";
import { Badge } from "@/common/ui/badge";
import { Users, UserCheck, AlertTriangle } from "lucide-react";

export function CapacityIndicator({
  current,
  limit,
  waitlist = 0,
  variant = "default",
  showWaitlist = true,
  className,
  ...props
}: CapacityIndicatorProps) {
  const percentage = Math.min(100, (current / limit) * 100);
  const hasWaitlist = waitlist > 0;
  const isFull = current >= limit;

  const getVariantStyles = () => {
    switch (variant) {
      case "compact":
        return "text-xs gap-1";
      case "detailed":
        return "text-sm gap-2";
      default:
        return "text-sm gap-1.5";
    }
  };

  const getProgressColor = () => {
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-orange-500";
    if (percentage >= 60) return "bg-yellow-500";
    return "bg-primary";
  };

  const getStatusIcon = () => {
    if (isFull) return <AlertTriangle className="h-4 w-4 text-destructive" />;
    return <Users className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div
      className={cn("space-y-2", getVariantStyles(), className)}
      {...props}
    >
      {/* Capacity numbers and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {getStatusIcon()}
          <span className="font-medium">
            {current}/{limit}
          </span>
          {isFull && (
            <Badge variant="destructive" className="text-xs">
              Full
            </Badge>
          )}
        </div>

        <span className="text-muted-foreground text-xs">
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Progress bar */}
      {variant !== "compact" && (
        <Progress
          value={percentage}
          className="h-2"
          aria-label={`Capacity: ${current} of ${limit} spots filled`}
        />
      )}

      {/* Waitlist info */}
      {showWaitlist && hasWaitlist && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <UserCheck className="h-3 w-3" />
          <span className="text-xs">
            {waitlist} on waitlist
          </span>
        </div>
      )}
    </div>
  );
}
```

#### 2.2.5 Loading States and Skeletons

```typescript
// modules/booking/pods/booking-dashboard/components/booking-skeleton/booking-skeleton.component.tsx
"use client";

import { cn } from "@/common/lib/utils";
import { Card, CardContent, CardHeader } from "@/common/ui/card";
import { Skeleton } from "@/common/ui/skeleton";

export function BookingSkeleton({ className, ...props }: BookingSkeletonProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)} {...props}>
      {/* Color stripe skeleton */}
      <div className="absolute top-0 left-0 w-1 h-full bg-muted" />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Progress bar skeleton */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>

        {/* Coach info skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>

        {/* Button skeleton */}
        <Skeleton className="h-9 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export function BookingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <BookingSkeleton key={i} />
      ))}
    </div>
  );
}
```

## 3. Responsive Design Strategy

### 3.1 Breakpoint System
```css
/* Following Tailwind's default breakpoints */
sm: 640px   /* Small devices */
md: 768px   /* Medium devices */
lg: 1024px  /* Large devices */
xl: 1280px  /* Extra large devices */
2xl: 1536px /* 2X Extra large devices */
```

### 3.2 Mobile-First Layout Patterns

**Grid Responsive Behavior:**
- Mobile (default): Single column, full-width cards
- Tablet (md): 2 columns
- Desktop (lg): 3 columns
- Large Desktop (xl): 4 columns

**Touch Targets:**
- Minimum 44px (h-11) for interactive elements
- Larger buttons on mobile (h-12)
- Increased padding for touch-friendly interactions

**Typography Scale:**
- Mobile: Smaller text sizes, tighter spacing
- Desktop: Larger text, more breathing room

### 3.3 Component Adaptability

```typescript
// Example of responsive component behavior
export function ResponsiveBookingCard({ booking, ...props }: BookingCardProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <BookingCard
      {...props}
      booking={booking}
      variant={isMobile ? "compact" : "detailed"}
      showCoachAvatar={!isMobile}
      actionButtonSize={isMobile ? "lg" : "default"}
    />
  );
}
```

## 4. Accessibility Strategy

### 4.1 ARIA Implementation

**Live Regions for Dynamic Content:**
```typescript
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {isLoading ? "Loading booking information" : `${bookings.length} classes available`}
</div>
```

**Proper Labeling:**
```typescript
<button
  aria-label={`Book ${booking.className} class at ${booking.time}`}
  aria-describedby={`capacity-${booking.id} coach-${booking.id}`}
>
  Book Class
</button>
```

**Focus Management:**
```typescript
// Focus trap in modals
import { useFocusTrap } from "@/common/hooks/use-focus-trap";

export function BookingModal({ isOpen, onClose }: BookingModalProps) {
  const focusTrapRef = useFocusTrap(isOpen);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent ref={focusTrapRef}>
        {/* Modal content */}
      </DialogContent>
    </Dialog>
  );
}
```

### 4.2 Keyboard Navigation

**Tab Order:**
1. Date navigation
2. Filter controls
3. Booking cards (in time order)
4. Action buttons within cards

**Keyboard Shortcuts:**
- Arrow keys: Navigate between time slots
- Enter/Space: Activate booking action
- Escape: Close modals/popovers

### 4.3 Screen Reader Support

```typescript
// Example of comprehensive screen reader support
<div
  role="article"
  aria-labelledby={`booking-title-${booking.id}`}
  aria-describedby={`booking-details-${booking.id}`}
>
  <h3 id={`booking-title-${booking.id}`}>
    {booking.className} at {booking.time}
  </h3>

  <div id={`booking-details-${booking.id}`} className="sr-only">
    Capacity: {booking.ocupation} of {booking.limit} spots filled.
    {booking.coachName && `Coached by ${booking.coachName}.`}
    {booking.waitlist > 0 && `${booking.waitlist} people on waitlist.`}
  </div>
</div>
```

## 5. Error State Components

### 5.1 Error Boundary UI

```typescript
// modules/booking/components/booking-error-fallback.component.tsx
export function BookingErrorFallback({
  error,
  onRetry,
  variant = "card"
}: BookingErrorFallbackProps) {
  return (
    <Card className="p-6 text-center space-y-4">
      <div className="flex justify-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">
          Unable to Load Bookings
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          We're having trouble connecting to the booking system.
          Please check your connection and try again.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>

        <Button variant="ghost" asChild>
          <a href="/support">Contact Support</a>
        </Button>
      </div>
    </Card>
  );
}
```

### 5.2 Empty States

```typescript
// modules/booking/components/empty-state.component.tsx
export function EmptyState({
  variant = "no-classes",
  action
}: EmptyStateProps) {
  const content = {
    "no-classes": {
      icon: Calendar,
      title: "No Classes Available",
      description: "There are no classes scheduled for this day. Try selecting a different date.",
      actionLabel: "View Tomorrow"
    },
    "no-results": {
      icon: Search,
      title: "No Classes Found",
      description: "Try adjusting your filters to see more classes.",
      actionLabel: "Clear Filters"
    }
  };

  const { icon: Icon, title, description, actionLabel } = content[variant];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>

      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md">{description}</p>

      {action && (
        <Button onClick={action} variant="outline">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
```

## 6. Animation and Transition Strategy

### 6.1 Micro-interactions

```typescript
// Smooth transitions for state changes
const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const capacityBarVariants = {
  initial: { width: 0 },
  animate: { width: "var(--capacity-width)" },
  transition: { duration: 0.5, ease: "easeOut" }
};
```

### 6.2 Loading Animations

```typescript
// Staggered loading animation for booking cards
const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};
```

## 7. Performance Optimization

### 7.1 Component Lazy Loading

```typescript
// Lazy load heavy components
const BookingModal = lazy(() => import("./booking-modal.component"));
const BookingCalendar = lazy(() => import("./booking-calendar.component"));
```

### 7.2 Memoization Strategy

```typescript
// Memoize expensive calculations
const MemoizedBookingCard = memo(BookingCard, (prevProps, nextProps) => {
  return (
    prevProps.booking.id === nextProps.booking.id &&
    prevProps.booking.ocupation === nextProps.booking.ocupation &&
    prevProps.isActionPending === nextProps.isActionPending
  );
});
```

## 8. Testing Strategy

### 8.1 Component Testing Patterns

```typescript
// modules/booking/pods/booking-dashboard/components/booking-card/booking-card.test.tsx
describe("BookingCard", () => {
  describe("unit tests", () => {
    it("should display booking information correctly", () => {
      render(<BookingCard booking={mockBooking} />);

      expect(screen.getByText(mockBooking.className)).toBeInTheDocument();
      expect(screen.getByText(mockBooking.time)).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        mockBooking.ocupation.toString()
      );
    });

    it("should show correct action button based on booking state", () => {
      const { rerender } = render(
        <BookingCard booking={{ ...mockBooking, bookState: null }} />
      );

      expect(screen.getByRole("button", { name: /book class/i })).toBeInTheDocument();

      rerender(<BookingCard booking={{ ...mockBooking, bookState: 1 }} />);

      expect(screen.getByRole("button", { name: /cancel booking/i })).toBeInTheDocument();
    });
  });

  describe("accessibility tests", () => {
    it("should have proper ARIA labels", () => {
      render(<BookingCard booking={mockBooking} />);

      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-label",
        expect.stringContaining("Capacity:")
      );
    });

    it("should support keyboard navigation", () => {
      render(<BookingCard booking={mockBooking} />);

      const button = screen.getByRole("button");
      button.focus();
      expect(button).toHaveFocus();
    });
  });
});
```

## Conclusion

This UI component strategy provides:

1. **Consistent Design Language**: Following established shadcn-ui patterns
2. **Mobile-First Responsive Design**: Optimized for all device sizes
3. **Comprehensive Accessibility**: WCAG 2.1 AA compliance
4. **Performance-Optimized**: Lazy loading, memoization, and virtualization
5. **Robust Error Handling**: Graceful degradation and recovery
6. **Maintainable Architecture**: Clear component hierarchy and separation of concerns

The components are designed to be reusable, testable, and follow the established patterns from the existing codebase while providing a superior user experience for the booking system.