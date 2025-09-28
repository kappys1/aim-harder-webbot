# CrossFit Booking System - Frontend Test Implementation Plan

## Overview

This document provides a comprehensive test implementation plan for the CrossFit booking system following TDD principles. The plan covers API services, business logic, component testing, and integration tests using React Testing Library and Vitest.

## Test Setup Requirements

### 1. Testing Dependencies Installation

First, the project needs testing dependencies added to `package.json`:

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/user-event": "^14.5.0",
    "@vitest/ui": "^2.0.0",
    "jsdom": "^24.0.0",
    "msw": "^2.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 2. Vitest Configuration

Create `vitest.config.ts` in the project root:

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
})
```

### 3. Test Setup File

Create `test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Global test utilities
global.fetch = vi.fn()
```

## Test Structure Organization

### Test File Naming Convention
- API Services: `*.service.test.ts`
- Business Logic: `*.business.test.ts`
- Components: `*.component.test.tsx`
- Hooks: `*.hook.test.tsx`
- Integration: `*.integration.test.tsx`

### Test Markers
Use the following markers for test categorization:
- `unit` - Unit tests
- `integration` - Integration tests
- `api` - API-related tests
- `auth` - Authentication tests

## 1. Booking API Service Tests

### File: `modules/booking/api/services/booking.service.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { bookingService } from './booking.service'
import type { BookingResponse } from '../models/booking.api'

// Mock axios
vi.mock('axios')

describe('BookingService', { concurrent: true }, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchBookings', () => {
    const mockParams = {
      day: '20250927',
      familyId: '123',
      box: '10122'
    }

    it('should fetch bookings successfully with correct parameters', async () => {
      // Test successful API call with proper parameter formatting
    })

    it('should handle authentication cookies correctly', async () => {
      // Test cookie forwarding and authentication
    })

    it('should handle network failures gracefully', async () => {
      // Test network error scenarios
    })

    it('should handle 401 unauthorized responses', async () => {
      // Test authentication failures
    })

    it('should handle 404 not found responses', async () => {
      // Test when API endpoint doesn't exist
    })

    it('should handle malformed response data', async () => {
      // Test invalid JSON or missing fields
    })

    it('should include cache busting timestamp', async () => {
      // Test timestamp parameter inclusion
    })

    it('should construct correct subdomain URL', async () => {
      // Test URL construction with box subdomain
    })
  })

  describe('error handling', () => {
    it('should throw BookingApiError for API failures', async () => {
      // Test custom error types
    })

    it('should include error context in thrown errors', async () => {
      // Test error details and context
    })
  })
})
```

### Test Data Factories

```typescript
// test/factories/booking.factory.ts
export const createMockBookingResponse = (overrides?: Partial<BookingResponse>): BookingResponse => ({
  clasesDisp: 'OPEN BOX,TEAM WOD,CROSSFIT',
  timetable: [
    { id: '0800_60', time: '08:00', duration: 60 },
    { id: '0900_60', time: '09:00', duration: 60 }
  ],
  day: 'Friday, September 27, 2024',
  bookings: [
    createMockBooking(),
    createMockBooking({ id: 2, time: '09:00 - 10:00', ocupation: 15, limit: 15 })
  ],
  seminars: [],
  ...overrides
})

export const createMockBooking = (overrides?: Partial<Booking>): Booking => ({
  id: 1,
  time: '08:00 - 09:00',
  timeid: '0800_60',
  className: 'OPEN BOX',
  boxName: 'CrossFit Cerdanyola',
  boxDir: 'Carrer Example, 123',
  boxPic: '/images/box.jpg',
  coachName: 'John Doe',
  coachPic: '/images/coach.jpg',
  enabled: 1,
  bookState: null,
  limit: 20,
  ocupation: 5,
  waitlist: 0,
  color: '#FF6B6B',
  classLength: 60,
  included: 1,
  ...overrides
})
```

## 2. Booking Business Logic Tests

### File: `modules/booking/business/booking.business.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { BookingBusiness } from './booking.business'
import { createMockBooking, createMockBookingResponse } from '../../../test/factories/booking.factory'

describe('BookingBusiness', { concurrent: true }, () => {
  const bookingBusiness = new BookingBusiness()

  describe('filterAvailableBookings', () => {
    it('should return only enabled bookings', () => {
      // Test filtering by enabled status
    })

    it('should exclude bookings where enabled is 0', () => {
      // Test disabled booking exclusion
    })
  })

  describe('calculateAvailability', () => {
    it('should calculate available spots correctly', () => {
      // Test: limit - ocupation = available spots
    })

    it('should handle full bookings', () => {
      // Test when ocupation >= limit
    })

    it('should identify waitlist situations', () => {
      // Test waitlist > 0 scenarios
    })
  })

  describe('getBookingStatus', () => {
    it('should return "available" for bookings with spots', () => {
      // Test available status
    })

    it('should return "full" for bookings at capacity', () => {
      // Test full status
    })

    it('should return "waitlist" for bookings with waitlist', () => {
      // Test waitlist status
    })

    it('should return "booked" for user booked classes', () => {
      // Test user booking status (bookState)
    })
  })

  describe('getUserBookingStatus', () => {
    it('should detect if user is already booked', () => {
      // Test bookState detection
    })

    it('should handle null bookState correctly', () => {
      // Test unbooked state
    })
  })

  describe('groupBookingsByTime', () => {
    it('should group bookings by time slots correctly', () => {
      // Test time-based grouping
    })

    it('should handle empty booking arrays', () => {
      // Test edge case handling
    })
  })

  describe('sortBookingsByTime', () => {
    it('should sort bookings chronologically', () => {
      // Test time sorting
    })

    it('should handle invalid time formats gracefully', () => {
      // Test error handling
    })
  })
})
```

## 3. Booking Component Tests

### File: `modules/booking/pods/booking-dashboard/booking-dashboard.component.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingDashboard } from './booking-dashboard.component'
import { createMockBookingResponse } from '../../../../test/factories/booking.factory'

// Mock the booking context
const mockBookingContext = {
  bookings: [],
  loading: false,
  error: null,
  fetchBookings: vi.fn(),
  selectedDate: new Date('2025-09-27'),
  setSelectedDate: vi.fn()
}

vi.mock('../hooks/useBookingContext.hook', () => ({
  useBookingContext: () => mockBookingContext
}))

describe('BookingDashboard Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial render', () => {
    it('should render loading state correctly', () => {
      mockBookingContext.loading = true
      render(<BookingDashboard />)

      expect(screen.getByTestId('booking-loading')).toBeInTheDocument()
      expect(screen.getByText('Loading bookings...')).toBeInTheDocument()
    })

    it('should render error state correctly', () => {
      mockBookingContext.loading = false
      mockBookingContext.error = 'Failed to fetch bookings'

      render(<BookingDashboard />)

      expect(screen.getByTestId('booking-error')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch bookings')).toBeInTheDocument()
    })

    it('should render empty state when no bookings', () => {
      mockBookingContext.loading = false
      mockBookingContext.error = null
      mockBookingContext.bookings = []

      render(<BookingDashboard />)

      expect(screen.getByTestId('booking-empty-state')).toBeInTheDocument()
      expect(screen.getByText('No bookings available')).toBeInTheDocument()
    })
  })

  describe('booking cards rendering', () => {
    const mockBookings = createMockBookingResponse().bookings

    beforeEach(() => {
      mockBookingContext.loading = false
      mockBookingContext.error = null
      mockBookingContext.bookings = mockBookings
    })

    it('should render booking cards with correct information', () => {
      render(<BookingDashboard />)

      // Check first booking card
      expect(screen.getByText('08:00 - 09:00')).toBeInTheDocument()
      expect(screen.getByText('OPEN BOX')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('5/20 spots')).toBeInTheDocument()
    })

    it('should display correct status indicators', () => {
      render(<BookingDashboard />)

      // Available booking
      expect(screen.getByTestId('status-available')).toBeInTheDocument()

      // Full booking (if any in mock data)
      const fullBooking = mockBookings.find(b => b.ocupation >= b.limit)
      if (fullBooking) {
        expect(screen.getByTestId('status-full')).toBeInTheDocument()
      }
    })

    it('should apply correct color coding for class types', () => {
      render(<BookingDashboard />)

      const bookingCard = screen.getByTestId('booking-card-1')
      expect(bookingCard).toHaveStyle('border-color: #FF6B6B')
    })
  })

  describe('user interactions', () => {
    it('should handle booking button click', async () => {
      const mockBookings = createMockBookingResponse().bookings
      mockBookingContext.bookings = mockBookings

      render(<BookingDashboard />)

      const bookButton = screen.getByTestId('book-button-1')
      await user.click(bookButton)

      // Should trigger booking action
      expect(mockBookingContext.fetchBookings).toHaveBeenCalled()
    })

    it('should handle date selection', async () => {
      render(<BookingDashboard />)

      const dateInput = screen.getByTestId('date-selector')
      await user.click(dateInput)

      // Should trigger date change
      expect(mockBookingContext.setSelectedDate).toHaveBeenCalled()
    })
  })

  describe('responsive behavior', () => {
    it('should render correctly on mobile viewports', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      render(<BookingDashboard />)

      const container = screen.getByTestId('booking-dashboard')
      expect(container).toHaveClass('mobile-layout')
    })

    it('should render correctly on desktop viewports', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      render(<BookingDashboard />)

      const container = screen.getByTestId('booking-dashboard')
      expect(container).toHaveClass('desktop-layout')
    })
  })
})
```

### File: `modules/booking/pods/booking-dashboard/components/booking-card/booking-card.component.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingCard } from './booking-card.component'
import { createMockBooking } from '../../../../../test/factories/booking.factory'

describe('BookingCard Component', () => {
  const user = userEvent.setup()
  const mockOnBook = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('booking information display', () => {
    it('should display all booking details correctly', () => {
      const booking = createMockBooking()

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      expect(screen.getByText('08:00 - 09:00')).toBeInTheDocument()
      expect(screen.getByText('OPEN BOX')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('5/20')).toBeInTheDocument()
    })

    it('should handle missing coach information', () => {
      const booking = createMockBooking({ coachName: null })

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      expect(screen.getByText('TBD')).toBeInTheDocument()
    })
  })

  describe('status indicators', () => {
    it('should show available status for bookings with spots', () => {
      const booking = createMockBooking({ ocupation: 5, limit: 20 })

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      expect(screen.getByTestId('status-available')).toBeInTheDocument()
      expect(screen.getByText('15 spots left')).toBeInTheDocument()
    })

    it('should show full status for capacity bookings', () => {
      const booking = createMockBooking({ ocupation: 20, limit: 20 })

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      expect(screen.getByTestId('status-full')).toBeInTheDocument()
      expect(screen.getByText('Full')).toBeInTheDocument()
    })

    it('should show waitlist status when waitlist exists', () => {
      const booking = createMockBooking({ ocupation: 20, limit: 20, waitlist: 3 })

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      expect(screen.getByTestId('status-waitlist')).toBeInTheDocument()
      expect(screen.getByText('Waitlist (3)')).toBeInTheDocument()
    })

    it('should show booked status for user booked classes', () => {
      const booking = createMockBooking({ bookState: 1 })

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      expect(screen.getByTestId('status-booked')).toBeInTheDocument()
      expect(screen.getByText('Booked')).toBeInTheDocument()
    })
  })

  describe('color coding', () => {
    it('should apply class type color correctly', () => {
      const booking = createMockBooking({ color: '#FF6B6B', className: 'OPEN BOX' })

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      const card = screen.getByTestId('booking-card')
      expect(card).toHaveStyle('border-left-color: #FF6B6B')
    })

    it('should have different colors for different class types', () => {
      const openBoxBooking = createMockBooking({ color: '#FF6B6B', className: 'OPEN BOX' })
      const teamWodBooking = createMockBooking({ color: '#4ECDC4', className: 'TEAM WOD' })

      const { rerender } = render(<BookingCard booking={openBoxBooking} onBook={mockOnBook} />)
      let card = screen.getByTestId('booking-card')
      expect(card).toHaveStyle('border-left-color: #FF6B6B')

      rerender(<BookingCard booking={teamWodBooking} onBook={mockOnBook} />)
      card = screen.getByTestId('booking-card')
      expect(card).toHaveStyle('border-left-color: #4ECDC4')
    })
  })

  describe('user interactions', () => {
    it('should handle book button click for available bookings', async () => {
      const booking = createMockBooking({ ocupation: 5, limit: 20 })

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      const bookButton = screen.getByRole('button', { name: /book/i })
      await user.click(bookButton)

      expect(mockOnBook).toHaveBeenCalledWith(booking.id)
    })

    it('should disable book button for full bookings', () => {
      const booking = createMockBooking({ ocupation: 20, limit: 20 })

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      const bookButton = screen.getByRole('button', { name: /full/i })
      expect(bookButton).toBeDisabled()
    })

    it('should show join waitlist button for waitlist bookings', async () => {
      const booking = createMockBooking({ ocupation: 20, limit: 20, waitlist: 3 })

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      const waitlistButton = screen.getByRole('button', { name: /join waitlist/i })
      await user.click(waitlistButton)

      expect(mockOnBook).toHaveBeenCalledWith(booking.id, 'waitlist')
    })
  })

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      const booking = createMockBooking()

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'Booking for OPEN BOX at 08:00 - 09:00')
    })

    it('should support keyboard navigation', async () => {
      const booking = createMockBooking()

      render(<BookingCard booking={booking} onBook={mockOnBook} />)

      const bookButton = screen.getByRole('button', { name: /book/i })
      bookButton.focus()

      await user.keyboard('{Enter}')
      expect(mockOnBook).toHaveBeenCalledWith(booking.id)
    })
  })
})
```

## 4. Booking Hooks Tests

### File: `modules/booking/hooks/useBooking.hook.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBooking } from './useBooking.hook'
import { createMockBookingResponse } from '../../../test/factories/booking.factory'

// Mock the booking service
vi.mock('../api/services/booking.service', () => ({
  bookingService: {
    fetchBookings: vi.fn()
  }
}))

describe('useBooking Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useBooking())

      expect(result.current.bookings).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.selectedDate).toBeInstanceOf(Date)
    })
  })

  describe('fetchBookings', () => {
    it('should fetch bookings successfully', async () => {
      const mockResponse = createMockBookingResponse()
      const mockFetchBookings = vi.fn().mockResolvedValue(mockResponse)

      vi.mocked(bookingService.fetchBookings).mockImplementation(mockFetchBookings)

      const { result } = renderHook(() => useBooking())

      await waitFor(() => {
        result.current.fetchBookings()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.bookings).toEqual(mockResponse.bookings)
        expect(result.current.error).toBe(null)
      })
    })

    it('should handle fetch errors correctly', async () => {
      const mockError = new Error('Network error')
      vi.mocked(bookingService.fetchBookings).mockRejectedValue(mockError)

      const { result } = renderHook(() => useBooking())

      await waitFor(() => {
        result.current.fetchBookings()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.bookings).toEqual([])
        expect(result.current.error).toBe('Network error')
      })
    })

    it('should set loading state during fetch', async () => {
      let resolvePromise: (value: any) => void
      const mockPromise = new Promise(resolve => {
        resolvePromise = resolve
      })

      vi.mocked(bookingService.fetchBookings).mockReturnValue(mockPromise)

      const { result } = renderHook(() => useBooking())

      result.current.fetchBookings()

      expect(result.current.loading).toBe(true)

      resolvePromise(createMockBookingResponse())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('date selection', () => {
    it('should update selected date', () => {
      const { result } = renderHook(() => useBooking())
      const newDate = new Date('2025-09-28')

      result.current.setSelectedDate(newDate)

      expect(result.current.selectedDate).toEqual(newDate)
    })

    it('should refetch bookings when date changes', async () => {
      const mockFetchBookings = vi.fn().mockResolvedValue(createMockBookingResponse())
      vi.mocked(bookingService.fetchBookings).mockImplementation(mockFetchBookings)

      const { result } = renderHook(() => useBooking())
      const newDate = new Date('2025-09-28')

      result.current.setSelectedDate(newDate)

      await waitFor(() => {
        expect(mockFetchBookings).toHaveBeenCalledWith({
          day: '20250928',
          familyId: expect.any(String),
          box: '10122'
        })
      })
    })
  })
})
```

### File: `modules/booking/hooks/useBookingContext.hook.test.tsx`

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { BookingProvider, useBookingContext } from './useBookingContext.hook'
import { ReactNode } from 'react'

const wrapper = ({ children }: { children: ReactNode }) => (
  <BookingProvider>{children}</BookingProvider>
)

describe('useBookingContext Hook', () => {
  describe('context provider', () => {
    it('should provide booking context values', () => {
      const { result } = renderHook(() => useBookingContext(), { wrapper })

      expect(result.current.bookings).toBeDefined()
      expect(result.current.loading).toBeDefined()
      expect(result.current.error).toBeDefined()
      expect(result.current.fetchBookings).toBeDefined()
      expect(result.current.selectedDate).toBeDefined()
      expect(result.current.setSelectedDate).toBeDefined()
    })

    it('should throw error when used outside provider', () => {
      const { result } = renderHook(() => useBookingContext())

      expect(result.error).toBeDefined()
      expect(result.error?.message).toContain('BookingProvider')
    })
  })
})
```

## 5. Integration Tests

### File: `modules/booking/booking.integration.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookingDashboard } from './pods/booking-dashboard/booking-dashboard.component'
import { BookingProvider } from './hooks/useBookingContext.hook'
import { createMockBookingResponse } from '../../test/factories/booking.factory'
import { server } from '../../test/mocks/server'
import { rest } from 'msw'

// Setup MSW for API mocking
beforeEach(() => {
  server.resetHandlers()
})

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <BookingProvider>
      {component}
    </BookingProvider>
  )
}

describe('Booking Integration Tests', () => {
  const user = userEvent.setup()

  describe('end-to-end booking flow', () => {
    it('should complete full booking flow successfully', async () => {
      // Setup successful API response
      server.use(
        rest.get('https://crossfitcerdanyola300.aimharder.com/api/bookings', (req, res, ctx) => {
          return res(ctx.json(createMockBookingResponse()))
        })
      )

      renderWithProvider(<BookingDashboard />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('08:00 - 09:00')).toBeInTheDocument()
      })

      // Click on a booking
      const bookButton = screen.getByRole('button', { name: /book/i })
      await user.click(bookButton)

      // Verify booking action
      await waitFor(() => {
        expect(screen.getByText('Booking successful')).toBeInTheDocument()
      })
    })

    it('should handle authentication failures during booking', async () => {
      // Setup 401 response
      server.use(
        rest.get('https://crossfitcerdanyola300.aimharder.com/api/bookings', (req, res, ctx) => {
          return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
        })
      )

      renderWithProvider(<BookingDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Authentication required')).toBeInTheDocument()
      })
    })
  })

  describe('real-time data updates', () => {
    it('should refresh bookings when date changes', async () => {
      let requestCount = 0
      server.use(
        rest.get('https://crossfitcerdanyola300.aimharder.com/api/bookings', (req, res, ctx) => {
          requestCount++
          return res(ctx.json(createMockBookingResponse()))
        })
      )

      renderWithProvider(<BookingDashboard />)

      // Initial load
      await waitFor(() => {
        expect(screen.getByText('08:00 - 09:00')).toBeInTheDocument()
      })

      // Change date
      const dateInput = screen.getByTestId('date-selector')
      await user.click(dateInput)

      // Verify new request was made
      await waitFor(() => {
        expect(requestCount).toBe(2)
      })
    })
  })

  describe('error boundary testing', () => {
    it('should handle unexpected component errors gracefully', async () => {
      // Force a component error
      const ThrowError = () => {
        throw new Error('Component crashed')
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <BookingProvider>
          <ThrowError />
        </BookingProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })

      consoleSpy.mockRestore()
    })
  })

  describe('network condition testing', () => {
    it('should handle slow network conditions', async () => {
      server.use(
        rest.get('https://crossfitcerdanyola300.aimharder.com/api/bookings', (req, res, ctx) => {
          return res(
            ctx.delay(3000), // 3 second delay
            ctx.json(createMockBookingResponse())
          )
        })
      )

      renderWithProvider(<BookingDashboard />)

      // Should show loading state
      expect(screen.getByTestId('booking-loading')).toBeInTheDocument()

      // Wait for response
      await waitFor(
        () => {
          expect(screen.getByText('08:00 - 09:00')).toBeInTheDocument()
        },
        { timeout: 5000 }
      )
    })

    it('should handle network timeouts', async () => {
      server.use(
        rest.get('https://crossfitcerdanyola300.aimharder.com/api/bookings', (req, res, ctx) => {
          return res.networkError('Connection timeout')
        })
      )

      renderWithProvider(<BookingDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })
  })
})
```

## 6. Mock Setup

### File: `test/mocks/server.ts`

```typescript
import { setupServer } from 'msw/node'
import { rest } from 'msw'
import { createMockBookingResponse } from '../factories/booking.factory'

export const server = setupServer(
  rest.get('https://crossfitcerdanyola300.aimharder.com/api/bookings', (req, res, ctx) => {
    return res(ctx.json(createMockBookingResponse()))
  })
)

// Start server before all tests
beforeAll(() => server.listen())

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Stop server after all tests
afterAll(() => server.close())
```

### File: `test/mocks/handlers.ts`

```typescript
import { rest } from 'msw'
import { createMockBookingResponse } from '../factories/booking.factory'

export const handlers = [
  // Successful booking fetch
  rest.get('https://crossfitcerdanyola300.aimharder.com/api/bookings', (req, res, ctx) => {
    const day = req.url.searchParams.get('day')
    const box = req.url.searchParams.get('box')

    if (!day || !box) {
      return res(ctx.status(400), ctx.json({ error: 'Missing parameters' }))
    }

    return res(ctx.json(createMockBookingResponse()))
  }),

  // Authentication error
  rest.get('https://crossfitcerdanyola300.aimharder.com/api/bookings', (req, res, ctx) => {
    return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }))
  }),

  // Server error
  rest.get('https://crossfitcerdanyola300.aimharder.com/api/bookings', (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ error: 'Internal server error' }))
  })
]
```

## 7. Test Utilities

### File: `test/utils/booking-test-utils.tsx`

```typescript
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { BookingProvider } from '../../modules/booking/hooks/useBookingContext.hook'

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BookingProvider>
      {children}
    </BookingProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Custom queries
export const getBookingCardByTime = (time: string) => {
  return screen.getByTestId(`booking-card-${time.replace(':', '')}`)
}

export const getBookingStatus = (bookingId: number) => {
  return screen.getByTestId(`booking-status-${bookingId}`)
}
```

## 8. Coverage Configuration

### File: `vitest.config.ts` (Coverage section)

```typescript
export default defineConfig({
  test: {
    // ... other config
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.config.{ts,js}',
        'coverage/'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
})
```

## 9. Test Execution Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --grep='unit'",
    "test:integration": "vitest run --grep='integration'",
    "test:api": "vitest run --grep='api'"
  }
}
```

## Key Testing Scenarios Summary

### Critical Test Cases
1. **Empty API Response**: Verify graceful handling of empty booking arrays
2. **Full Bookings**: Test capacity calculations and waitlist logic
3. **User Booking Status**: Verify detection of user's booked classes
4. **Mixed States**: Test complex scenarios with various booking statuses
5. **Responsive Design**: Verify mobile vs desktop rendering
6. **Network Failures**: Test error handling and retry logic
7. **Authentication**: Test cookie-based auth and 401 handling
8. **Real-time Updates**: Test data refreshing and state synchronization

### Performance Considerations
- Use `concurrent: true` for parallel test execution
- Mock heavy dependencies (API calls, large data sets)
- Use MSW for realistic API mocking
- Implement proper cleanup in hooks and components

### Accessibility Testing
- Verify ARIA labels and roles
- Test keyboard navigation
- Ensure color coding has text alternatives
- Validate screen reader compatibility

This comprehensive test plan ensures the booking system is thoroughly tested from unit level to integration, providing confidence in the implementation while following TDD principles.