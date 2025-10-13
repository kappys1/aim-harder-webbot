# Testing Quick Reference Card

**For**: AimHarder WOD Bot Testing Implementation
**Framework**: Vitest + React Testing Library

---

## Common Testing Patterns

### 1. Service Layer Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ServiceName', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should perform action successfully', async () => {
    // Arrange
    const mockData = { id: '1', name: 'test' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData
    })

    // Act
    const result = await service.method()

    // Assert
    expect(result).toEqual(mockData)
    expect(fetch).toHaveBeenCalledWith(/* expected args */)
  })

  it('should handle errors gracefully', async () => {
    // Arrange
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    // Act & Assert
    await expect(service.method()).rejects.toThrow('Network error')
  })
})
```

---

### 2. Hook Test Template

```typescript
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

describe('useCustomHook', () => {
  it('should update state on action', async () => {
    // Arrange
    const { result } = renderHook(() => useCustomHook())

    // Act
    await act(async () => {
      await result.current.performAction()
    })

    // Assert
    await waitFor(() => {
      expect(result.current.data).toBeDefined()
    })
  })

  it('should handle loading states', () => {
    // Arrange
    const { result } = renderHook(() => useCustomHook())

    // Assert
    expect(result.current.isLoading).toBe(false)

    // Act
    act(() => {
      result.current.startLoading()
    })

    // Assert
    expect(result.current.isLoading).toBe(true)
  })
})
```

---

### 3. Component Test Template

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

describe('ComponentName', () => {
  it('should render correctly', () => {
    // Arrange & Act
    render(<ComponentName />)

    // Assert
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })

  it('should handle user interaction', async () => {
    // Arrange
    const user = userEvent.setup()
    const mockHandler = vi.fn()
    render(<ComponentName onAction={mockHandler} />)

    // Act
    await user.click(screen.getByRole('button', { name: /submit/i }))

    // Assert
    await waitFor(() => {
      expect(mockHandler).toHaveBeenCalledTimes(1)
    })
  })

  it('should display error message', async () => {
    // Arrange
    render(<ComponentName hasError={true} />)

    // Assert
    expect(screen.getByText(/error/i)).toBeInTheDocument()
  })
})
```

---

### 4. Context Provider Test Template

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('useContextHook', () => {
  it('should provide initial state', () => {
    // Arrange & Act
    const { result } = renderHook(() => useContextHook(), {
      wrapper: ({ children }) => <Provider>{children}</Provider>
    })

    // Assert
    expect(result.current.state).toBeDefined()
  })

  it('should update state via actions', () => {
    // Arrange
    const { result } = renderHook(() => useContextHook(), {
      wrapper: ({ children }) => <Provider>{children}</Provider>
    })

    // Act
    act(() => {
      result.current.actions.updateState('new value')
    })

    // Assert
    expect(result.current.state.value).toBe('new value')
  })

  it('should throw error when used outside provider', () => {
    // Arrange, Act & Assert
    expect(() => {
      renderHook(() => useContextHook())
    }).toThrow('must be used within a Provider')
  })
})
```

---

### 5. Utility Function Test Template

```typescript
import { describe, it, expect } from 'vitest'

describe('utilityFunction', () => {
  it('should handle valid input', () => {
    // Arrange
    const input = 'test'

    // Act
    const result = utilityFunction(input)

    // Assert
    expect(result).toBe('expected output')
  })

  it('should handle edge cases', () => {
    // Edge case: empty string
    expect(utilityFunction('')).toBe('')

    // Edge case: null
    expect(utilityFunction(null)).toBe(null)

    // Edge case: undefined
    expect(utilityFunction(undefined)).toBe(undefined)
  })

  it('should throw error for invalid input', () => {
    // Arrange
    const invalidInput = {}

    // Act & Assert
    expect(() => utilityFunction(invalidInput)).toThrow()
  })
})
```

---

### 6. API Route Test Template (Next.js)

```typescript
import { describe, it, expect, vi } from 'vitest'
import { POST } from './route'

describe('API Route: /api/endpoint', () => {
  it('should handle successful request', async () => {
    // Arrange
    const request = new Request('http://localhost:3000/api/endpoint', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' })
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should validate request body', async () => {
    // Arrange
    const request = new Request('http://localhost:3000/api/endpoint', {
      method: 'POST',
      body: JSON.stringify({}) // Missing required fields
    })

    // Act
    const response = await POST(request)
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})
```

---

## RTL Query Priority

**Use in this order** (most to least preferred):

1. **getByRole** - Best for accessibility
   ```typescript
   screen.getByRole('button', { name: /submit/i })
   screen.getByRole('textbox', { name: /email/i })
   ```

2. **getByLabelText** - For form inputs
   ```typescript
   screen.getByLabelText(/email/i)
   ```

3. **getByPlaceholderText** - When no label
   ```typescript
   screen.getByPlaceholderText(/enter email/i)
   ```

4. **getByText** - For non-interactive content
   ```typescript
   screen.getByText(/welcome/i)
   ```

5. **getByDisplayValue** - For inputs with values
   ```typescript
   screen.getByDisplayValue('John Doe')
   ```

6. **getByAltText** - For images
   ```typescript
   screen.getByAltText(/logo/i)
   ```

7. **getByTestId** - Last resort only
   ```typescript
   screen.getByTestId('custom-element')
   ```

---

## Query Variants

### get vs query vs find

```typescript
// getBy* - Throws error if not found (use for elements that MUST exist)
const button = screen.getByRole('button')

// queryBy* - Returns null if not found (use for elements that might not exist)
const error = screen.queryByText(/error/i)
expect(error).not.toBeInTheDocument()

// findBy* - Async, waits for element (use for elements that appear after async)
const message = await screen.findByText(/success/i)
```

### All variants

```typescript
// Single element
getBy*, queryBy*, findBy*

// Multiple elements
getAllBy*, queryAllBy*, findAllBy*
```

---

## Common Assertions

### DOM Assertions
```typescript
expect(element).toBeInTheDocument()
expect(element).toBeVisible()
expect(element).toBeEnabled()
expect(element).toBeDisabled()
expect(element).toHaveTextContent('text')
expect(element).toHaveAttribute('aria-label', 'value')
expect(element).toHaveClass('className')
expect(element).toHaveStyle({ color: 'red' })
```

### Form Assertions
```typescript
expect(input).toHaveValue('text')
expect(checkbox).toBeChecked()
expect(select).toHaveDisplayValue('Option 1')
expect(input).toHaveFocus()
```

### Accessibility Assertions
```typescript
expect(button).toHaveAccessibleName('Submit')
expect(input).toHaveAccessibleDescription('Enter your email')
```

---

## User Event API

### Setup
```typescript
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
```

### Common Actions
```typescript
// Click
await user.click(button)
await user.dblClick(button)

// Type
await user.type(input, 'Hello World')
await user.clear(input)

// Keyboard
await user.keyboard('{Enter}')
await user.keyboard('{Escape}')
await user.tab()

// Selection
await user.selectOptions(select, 'option1')

// Clipboard
await user.copy()
await user.paste()

// Upload
await user.upload(fileInput, file)
```

---

## Async Testing

### waitFor
```typescript
// Wait for element to appear
await waitFor(() => {
  expect(screen.getByText(/loaded/i)).toBeInTheDocument()
})

// Wait with timeout
await waitFor(() => {
  expect(mockFn).toHaveBeenCalled()
}, { timeout: 3000 })
```

### findBy (built-in waitFor)
```typescript
const element = await screen.findByText(/loaded/i)
```

### act()
```typescript
// Wrap state updates
await act(async () => {
  await result.current.fetchData()
})
```

---

## Mocking

### Mock Functions
```typescript
const mockFn = vi.fn()
mockFn.mockReturnValue('value')
mockFn.mockResolvedValue('async value')
mockFn.mockRejectedValue(new Error('error'))

expect(mockFn).toHaveBeenCalled()
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
expect(mockFn).toHaveBeenCalledTimes(2)
```

### Mock Modules
```typescript
vi.mock('@/module/path', () => ({
  functionName: vi.fn().mockReturnValue('mocked')
}))
```

### Mock Fetch
```typescript
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'test' })
})
```

### Mock Timers
```typescript
vi.useFakeTimers()

// Fast-forward time
vi.advanceTimersByTime(1000)
vi.runAllTimers()

// Restore
vi.useRealTimers()
```

### Mock localStorage
```typescript
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
}
global.localStorage = localStorageMock as any
```

---

## Custom Render Function

```typescript
import { render } from '@testing-library/react'
import { BookingProvider } from '@/modules/booking/hooks/useBookingContext.hook'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function customRender(
  ui: React.ReactElement,
  {
    withBookingProvider = false,
    withQueryClient = false,
    ...options
  } = {}
) {
  let Wrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>

  if (withQueryClient) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    const PrevWrapper = Wrapper
    Wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <PrevWrapper>{children}</PrevWrapper>
      </QueryClientProvider>
    )
  }

  if (withBookingProvider) {
    const PrevWrapper = Wrapper
    Wrapper = ({ children }) => (
      <BookingProvider>
        <PrevWrapper>{children}</PrevWrapper>
      </BookingProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...options })
}
```

**Usage**:
```typescript
import { customRender as render } from '@/tests/utils/test-utils'

render(<Component />, { withBookingProvider: true })
```

---

## Common Pitfalls

### ❌ Don't: Query during render
```typescript
// BAD
const { container } = render(<Component />)
const button = container.querySelector('.button') // Fragile!
```

### ✅ Do: Use semantic queries
```typescript
// GOOD
render(<Component />)
const button = screen.getByRole('button', { name: /submit/i })
```

---

### ❌ Don't: Test implementation details
```typescript
// BAD
expect(component.state.count).toBe(5)
```

### ✅ Do: Test visible behavior
```typescript
// GOOD
expect(screen.getByText('Count: 5')).toBeInTheDocument()
```

---

### ❌ Don't: Forget to wait for async
```typescript
// BAD - Race condition!
render(<AsyncComponent />)
expect(screen.getByText(/loaded/i)).toBeInTheDocument() // Might not be there yet!
```

### ✅ Do: Use findBy or waitFor
```typescript
// GOOD
render(<AsyncComponent />)
const text = await screen.findByText(/loaded/i)
expect(text).toBeInTheDocument()
```

---

### ❌ Don't: Use act() everywhere
```typescript
// BAD - Unnecessary
await act(async () => {
  await user.click(button)
})
```

### ✅ Do: Only when needed (direct state updates)
```typescript
// GOOD - Only for direct state changes
await act(async () => {
  await result.current.fetchData()
})

// userEvent already wraps in act()
await user.click(button) // No act() needed!
```

---

## Debugging Tests

### Screen Debug
```typescript
import { screen } from '@testing-library/react'

screen.debug() // Print entire DOM
screen.debug(element) // Print specific element
screen.logTestingPlaygroundURL() // Get playground URL
```

### Find Queries
```typescript
// See all roles
screen.logRoles()

// Get suggestions
screen.getByRole('buton') // Typo - suggests 'button'
```

### VS Code Debug
```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--run"],
  "console": "integratedTerminal"
}
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- -t "should login"

# Run with UI
npm run test:ui
```

---

## Coverage Reports

### View Coverage
```bash
npm run test:coverage
```

### Coverage Files
- `coverage/index.html` - HTML report (open in browser)
- `coverage/coverage-final.json` - Raw coverage data
- `coverage/lcov.info` - LCOV format (for CI)

### Ignore from Coverage
```typescript
/* c8 ignore next */
if (process.env.NODE_ENV === 'development') {
  // Debug code
}

/* c8 ignore start */
function debugFunction() {
  // Entire function ignored
}
/* c8 ignore stop */
```

---

## Quick Checklist

Before committing tests, verify:

- [ ] All tests pass
- [ ] Tests are deterministic (no random failures)
- [ ] Mocks are cleaned up in `afterEach`
- [ ] Async operations use `await`
- [ ] Error cases are tested
- [ ] Loading states are tested
- [ ] Semantic queries used (getByRole, etc.)
- [ ] No implementation details tested
- [ ] Coverage meets threshold (80%+)

---

**Last Updated**: 2025-10-04
**Reference**: See `testing-plan.md` for detailed implementation guide
