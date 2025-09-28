# CrossFit Booking System UI/UX Implementation Plan

## Executive Summary

This document outlines a comprehensive UI/UX implementation plan for the CrossFit booking system using shadcn/ui components. The design prioritizes mobile-first approach, clear visual hierarchy, and intuitive booking interactions optimized for athletes on-the-go.

## 1. Dashboard Layout Design

### 1.1 Main Dashboard Structure
```
┌─────────────────────────────────────┐
│ Header: "My CrossFit Boxes"         │
├─────────────────────────────────────┤
│ Box Card: CrossFit Cerdanyola       │
│ ┌─────────────────────────────────┐ │
│ │ Box Image + Logo                │ │
│ │ Box Name + Location             │ │
│ │ Today's Classes Available       │ │
│ │ "View Schedule" Button          │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Date Selector (Calendar View)       │
├─────────────────────────────────────┤
│ Today's Bookings Overview          │
└─────────────────────────────────────┘
```

**Components Used:**
- `Card` with `CardHeader`, `CardContent`, `CardFooter`
- `Button` for navigation
- `Calendar` for date selection
- `Badge` for quick stats
- `Avatar` for box branding

### 1.2 Box Overview Card
```typescript
interface BoxCard {
  // Visual Elements
  boxImage: string;           // Hero image of the box
  boxLogo: string;           // Box logo/branding

  // Information
  boxName: string;           // "CrossFit Cerdanyola"
  location: string;          // Box address
  todayClassCount: number;   // Available classes today

  // Actions
  onViewSchedule: () => void;
}
```

## 2. Booking Cards Design

### 2.1 Booking Card Layout (Mobile Priority)
```
┌───────────────────────────────────────┐
│ ┌─────┐ TIME SLOT        STATUS_BADGE │
│ │CLASS│ 08:00 - 09:00    ● AVAILABLE  │
│ │COLOR│ OPEN BOX         [Book Now]   │
│ └─────┘                              │
├───────────────────────────────────────┤
│ 👨‍🏫 Coach: John Smith     💪 8/12      │
│ 📍 CrossFit Cerdanyola    ⏱️ 60 min   │
└───────────────────────────────────────┘
```

### 2.2 Card Status States

#### Available Class (Green Accent)
```css
border-left: 4px solid hsl(var(--accent)); /* Success Green */
background: hsl(var(--card));
```

#### User Booked (Primary Blue)
```css
border-left: 4px solid hsl(var(--primary)); /* Deep Athletic Blue */
background: linear-gradient(to right, hsl(var(--primary) / 0.05), hsl(var(--card)));
```

#### Full Class (Muted)
```css
border-left: 4px solid hsl(var(--muted-foreground));
background: hsl(var(--muted) / 0.5);
opacity: 0.7;
```

#### Waitlist Available (Secondary Orange)
```css
border-left: 4px solid hsl(var(--secondary)); /* Energy Orange */
background: hsl(var(--secondary) / 0.05);
```

### 2.3 Class Type Color Coding
Use the `color` field from API with opacity overlays:
```typescript
const getClassTypeStyle = (color: string, bookState: number) => {
  const rgbColor = color; // "rgb(255, 100, 50)" from API

  return {
    '--class-color': rgbColor,
    '--class-color-light': `${rgbColor.replace('rgb', 'rgba').replace(')', ', 0.1)')}`
  };
};
```

## 3. Mobile vs Desktop Optimization

### 3.1 Mobile Layout (< 768px)
- **Single column layout** for booking cards
- **Full-width cards** with condensed information
- **Large touch targets** (minimum 44px)
- **Swipe gestures** for navigation between days
- **Sticky date selector** at top
- **Bottom sheet** for booking confirmations

**Mobile Card Structure:**
```
┌─────────────────────────────────┐
│ TIME + CLASS TYPE               │
│ 08:00-09:00 | OPEN BOX         │
│ ───────────────────────────────│
│ Coach: John     Spots: 8/12    │
│ [    Book Now Button    ]      │
└─────────────────────────────────┘
```

### 3.2 Desktop Layout (≥ 768px)
- **Grid layout** (2-3 columns based on screen size)
- **Expanded information** display
- **Hover states** for better interaction feedback
- **Side panel** for detailed booking information
- **Quick booking modal** for faster interactions

**Desktop Card Structure:**
```
┌─────────────────────────────────────┐
│ ┌─────┐ 08:00 - 09:00    [Book Now] │
│ │CLASS│ OPEN BOX         ● Available │
│ │COLOR│                             │
│ └─────┘ 👨‍🏫 Coach: John Smith       │
│         📍 CrossFit Cerdanyola      │
│         💪 8/12 spots   ⏱️ 60 min   │
└─────────────────────────────────────┘
```

### 3.3 Responsive Breakpoints
```css
/* Mobile: Stack vertically */
.booking-grid {
  @apply grid grid-cols-1 gap-4;
}

/* Tablet: 2 columns */
@media (min-width: 640px) {
  .booking-grid {
    @apply grid-cols-2;
  }
}

/* Desktop: 3 columns */
@media (min-width: 1024px) {
  .booking-grid {
    @apply grid-cols-3;
  }
}
```

## 4. Interactive Elements

### 4.1 Booking Button States
```typescript
interface BookingButtonProps {
  bookState: number | null;
  enabled: number;
  ocupation: number;
  limit: number;
  waitlist: number;
}

const getBookingButtonConfig = (props: BookingButtonProps) => {
  if (props.bookState === 1) {
    return {
      text: "Booked ✓",
      variant: "secondary",
      disabled: false,
      action: "cancel" // Allow cancellation
    };
  }

  if (props.enabled === 0) {
    return {
      text: "Unavailable",
      variant: "outline",
      disabled: true,
      action: null
    };
  }

  if (props.ocupation >= props.limit) {
    if (props.waitlist > 0) {
      return {
        text: "Join Waitlist",
        variant: "outline",
        disabled: false,
        action: "waitlist"
      };
    }
    return {
      text: "Full",
      variant: "outline",
      disabled: true,
      action: null
    };
  }

  return {
    text: "Book Now",
    variant: "default",
    disabled: false,
    action: "book"
  };
};
```

### 4.2 Interactive Feedback
- **Loading states** during API calls
- **Success animations** for completed bookings
- **Error toast notifications** for failed actions
- **Optimistic UI updates** for better perceived performance

### 4.3 Gesture Support (Mobile)
- **Pull-to-refresh** for updating booking data
- **Swipe left/right** for navigating between dates
- **Long press** for quick booking actions

## 5. Status Indicators Design

### 5.1 Capacity Indicator Component
```typescript
interface CapacityIndicatorProps {
  ocupation: number;
  limit: number;
  waitlist: number;
}

const CapacityIndicator = ({ ocupation, limit, waitlist }: CapacityIndicatorProps) => {
  const percentage = Math.min((ocupation / limit) * 100, 100);
  const status = getCapacityStatus(ocupation, limit);

  return (
    <div className="flex items-center gap-2">
      <Progress
        value={percentage}
        className={`flex-1 h-2 ${status.progressClass}`}
      />
      <Badge variant={status.badgeVariant}>
        {ocupation}/{limit}
      </Badge>
      {waitlist > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{waitlist} waiting
        </Badge>
      )}
    </div>
  );
};
```

### 5.2 Status Badge System
```typescript
const statusConfigs = {
  available: {
    icon: "🟢",
    text: "Available",
    badgeVariant: "secondary",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  },
  limited: {
    icon: "🟡",
    text: "Limited",
    badgeVariant: "outline",
    badgeClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
  },
  full: {
    icon: "🔴",
    text: "Full",
    badgeVariant: "destructive",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  },
  waitlist: {
    icon: "🟠",
    text: "Waitlist",
    badgeVariant: "secondary",
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
  },
  booked: {
    icon: "✅",
    text: "Booked",
    badgeVariant: "default",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  }
};
```

### 5.3 Visual Hierarchy for Status
1. **Primary**: Time slot (largest, bold)
2. **Secondary**: Class type with color coding
3. **Tertiary**: Capacity and coach information
4. **Quaternary**: Location and duration details

## 6. Component Architecture

### 6.1 Core Components Structure

```
modules/booking/pods/booking-dashboard/components/
├── booking-card/
│   ├── booking-card.component.tsx
│   ├── booking-card.types.ts
│   ├── booking-card.styles.ts
│   └── booking-card.test.tsx
├── capacity-indicator/
│   ├── capacity-indicator.component.tsx
│   ├── capacity-indicator.types.ts
│   └── capacity-indicator.test.tsx
├── class-type-badge/
│   ├── class-type-badge.component.tsx
│   └── class-type-badge.types.ts
├── booking-grid/
│   ├── booking-grid.component.tsx
│   └── booking-grid.types.ts
├── time-slot-header/
│   ├── time-slot-header.component.tsx
│   └── time-slot-header.types.ts
└── booking-status-indicator/
    ├── booking-status-indicator.component.tsx
    └── booking-status-indicator.types.ts
```

### 6.2 shadcn/ui Components Required

**Primary Components:**
- `Card`, `CardContent`, `CardHeader`, `CardFooter`
- `Button` (variants: default, outline, secondary)
- `Badge` (variants: default, secondary, destructive, outline)
- `Avatar`, `AvatarImage`, `AvatarFallback`
- `Progress`
- `Calendar`

**Secondary Components:**
- `Dialog`, `DialogContent`, `DialogHeader` (for booking confirmations)
- `Toast` (for notifications)
- `Skeleton` (for loading states)
- `Separator`
- `ScrollArea`

**Utility Components:**
- `cn` utility from @/lib/utils
- `Tooltip`, `TooltipContent`, `TooltipTrigger`

## 7. Implementation Roadmap

### 7.1 Phase 1: Core Components (Week 1)
1. **BookingCard component** with all status states
2. **CapacityIndicator component** with progress visualization
3. **ClassTypeBadge component** with color coding
4. **BookingGrid layout** with responsive design

### 7.2 Phase 2: Interactions (Week 2)
1. **Booking actions** (book, cancel, waitlist)
2. **Loading states** and optimistic updates
3. **Error handling** and toast notifications
4. **Mobile gestures** and touch optimizations

### 7.3 Phase 3: Polish & Optimization (Week 3)
1. **Animation refinements**
2. **Accessibility improvements** (ARIA labels, keyboard navigation)
3. **Performance optimizations**
4. **A/B testing setup** for booking flow

## 8. Accessibility Considerations

### 8.1 Color Accessibility
- **Never rely solely on color** for status indication
- **Include text labels** alongside color coding
- **Ensure WCAG 2.1 AA contrast ratios** for all text
- **Support high contrast mode**

### 8.2 Keyboard Navigation
- **Tab order** follows logical booking flow
- **Enter/Space** activates booking buttons
- **Arrow keys** navigate between time slots
- **Escape** closes modals and dialogs

### 8.3 Screen Reader Support
```tsx
<Card
  role="article"
  aria-labelledby={`class-${booking.id}`}
  aria-describedby={`capacity-${booking.id} status-${booking.id}`}
>
  <CardHeader>
    <h3 id={`class-${booking.id}`}>
      {booking.time} - {booking.className}
    </h3>
  </CardHeader>
  <CardContent>
    <div id={`capacity-${booking.id}`} aria-live="polite">
      {ocupation} of {limit} spots taken
    </div>
    <div id={`status-${booking.id}`}>
      Class status: {getStatusText(booking)}
    </div>
  </CardContent>
</Card>
```

## 9. Performance Considerations

### 9.1 Optimization Strategies
- **Virtual scrolling** for large lists of bookings
- **Lazy loading** for booking images
- **Memoization** of expensive calculations (capacity percentages)
- **Debounced API calls** for real-time updates

### 9.2 Caching Strategy
- **React Query** for API state management
- **Optimistic updates** for immediate feedback
- **Background refetch** for real-time capacity updates
- **Stale-while-revalidate** for better perceived performance

## 10. Design System Integration

### 10.1 Color Palette Usage
```css
/* Primary Actions */
.booking-available {
  border-color: hsl(var(--accent)); /* Success Green */
}

/* User Bookings */
.booking-booked {
  border-color: hsl(var(--primary)); /* Deep Athletic Blue */
}

/* Warnings/Waitlist */
.booking-waitlist {
  border-color: hsl(var(--secondary)); /* Energy Orange */
}

/* Disabled/Full */
.booking-full {
  border-color: hsl(var(--muted-foreground));
}
```

### 10.2 Typography Scale
- **Time slots**: `text-lg font-semibold` (18px, semi-bold)
- **Class names**: `text-base font-medium` (16px, medium)
- **Coach/Details**: `text-sm text-muted-foreground` (14px, muted)
- **Capacity**: `text-xs font-mono` (12px, monospace for numbers)

## 11. Testing Strategy

### 11.1 Component Testing
- **Unit tests** for all booking logic
- **Visual regression tests** for different states
- **Accessibility tests** with jest-axe
- **Mobile interaction tests** with touch events

### 11.2 Integration Testing
- **Booking flow** end-to-end scenarios
- **API integration** with mock responses
- **Responsive design** across breakpoints
- **Performance benchmarks** for large datasets

## 12. Future Enhancements

### 12.1 Advanced Features
- **Real-time updates** via WebSocket connections
- **Push notifications** for booking reminders
- **Calendar integration** (Google Calendar, Apple Calendar)
- **Social features** (see friends' bookings)

### 12.2 Analytics Integration
- **Booking conversion rates** by time/class type
- **User engagement metrics**
- **A/B testing** for different card layouts
- **Performance monitoring** with Web Vitals

---

## Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Basic booking card | High | Medium | **P0** |
| Mobile responsive | High | Low | **P0** |
| Status indicators | High | Low | **P0** |
| Capacity visualization | Medium | Low | **P1** |
| Interactive booking | High | High | **P1** |
| Loading states | Medium | Low | **P1** |
| Accessibility features | Medium | Medium | **P2** |
| Advanced animations | Low | Medium | **P3** |

This implementation plan provides a comprehensive foundation for building a world-class CrossFit booking interface that prioritizes usability, performance, and the unique needs of fitness enthusiasts.