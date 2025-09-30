# Frontend Testing Plan: Token Refresh System

## ⚠️ KISS Principle Applied: MINIMAL Essential Tests Only

**Philosophy**: Test what can BREAK the app, skip what's obvious.

---

## 1. Test File Structure

```
modules/auth/
├── hooks/
│   ├── useTokenRefresh.hook.tsx
│   └── __tests__/
│       └── useTokenRefresh.test.tsx
└── context/
    └── __tests__/
        └── AuthContext.token-refresh.test.tsx
```

---

## 2. Mock Strategy

### Timer Mocking (Vitest)
```typescript
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// En test:
vi.advanceTimersByTime(25 * 60 * 1000); // 25 minutes
```

### API Call Mocking
```typescript
import { vi } from 'vitest';

const mockTokenUpdate = vi.fn();

vi.mock('@/common/services/token-refresh.service', () => ({
  tokenRefreshService: {
    updateToken: mockTokenUpdate
  }
}));
```

### localStorage Mocking
```typescript
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

global.localStorage = mockLocalStorage as any;
```

---

## 3. Essential Test Cases

### Test File: `useTokenRefresh.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenRefresh } from '../useTokenRefresh.hook';

describe('useTokenRefresh - MINIMAL ESSENTIAL TESTS', () => {

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ✅ TEST 1: Timer inicia y llama API después de 25 min
  it('should call token update API after 25 minutes', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ newToken: 'token123' });

    renderHook(() => useTokenRefresh({
      updateToken: mockUpdate,
      refreshToken: 'oldToken',
      fingerprint: 'fp123'
    }));

    // Avanzar 25 minutos
    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      token: 'oldToken',
      fingerprint: 'fp123'
    });
  });

  // ✅ TEST 2: Actualiza localStorage con nuevo token
  it('should update localStorage with new token', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ newToken: 'newToken456' });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    renderHook(() => useTokenRefresh({
      updateToken: mockUpdate,
      refreshToken: 'oldToken',
      fingerprint: 'fp123'
    }));

    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    expect(setItemSpy).toHaveBeenCalledWith('refreshToken', 'newToken456');
  });

  // ✅ TEST 3: Cleanup - detiene timer al desmontar
  it('should cleanup timer on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useTokenRefresh({
      updateToken: vi.fn(),
      refreshToken: 'token',
      fingerprint: 'fp'
    }));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  // ✅ TEST 4: CRÍTICO - Logout en caso de error
  it('should logout user if API returns logout flag', async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ logout: true });
    const mockLogout = vi.fn();

    renderHook(() => useTokenRefresh({
      updateToken: mockUpdate,
      refreshToken: 'token',
      fingerprint: 'fp',
      onLogout: mockLogout
    }));

    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    expect(mockLogout).toHaveBeenCalled();
  });

  // ✅ TEST 5: CRÍTICO - No inicia timer si no hay refreshToken
  it('should NOT start timer if no refreshToken', () => {
    const mockUpdate = vi.fn();

    renderHook(() => useTokenRefresh({
      updateToken: mockUpdate,
      refreshToken: null,
      fingerprint: 'fp'
    }));

    act(() => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
```

---

## 4. Critical Edge Cases (Only These)

### ⚠️ Edge Case 1: Network Failure During Refresh
**Why Test**: App must NOT crash if API fails
**Expected**: Log error, retry next cycle

```typescript
it('should handle network failure gracefully', async () => {
  const mockUpdate = vi.fn().mockRejectedValue(new Error('Network error'));
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  renderHook(() => useTokenRefresh({
    updateToken: mockUpdate,
    refreshToken: 'token',
    fingerprint: 'fp'
  }));

  await act(async () => {
    vi.advanceTimersByTime(25 * 60 * 1000);
  });

  // App should NOT crash
  expect(consoleSpy).toHaveBeenCalled();

  consoleSpy.mockRestore();
});
```

### ⚠️ Edge Case 2: Multiple Timers (Component Re-render)
**Why Test**: Prevent memory leaks and duplicate API calls
**Expected**: Only 1 active timer

```typescript
it('should prevent multiple timers on re-render', () => {
  const mockUpdate = vi.fn();
  const setIntervalSpy = vi.spyOn(global, 'setInterval');

  const { rerender } = renderHook(() => useTokenRefresh({
    updateToken: mockUpdate,
    refreshToken: 'token',
    fingerprint: 'fp'
  }));

  const firstCallCount = setIntervalSpy.mock.calls.length;

  // Re-render component
  rerender();

  // Should NOT create a new timer
  expect(setIntervalSpy).toHaveBeenCalledTimes(firstCallCount);
});
```

---

## 5. Integration Test: AuthContext

### Test File: `AuthContext.token-refresh.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthContext';

describe('AuthContext - Token Refresh Integration', () => {

  // ✅ TEST: Timer starts after login
  it('should start refresh timer after successful login', async () => {
    const mockUpdate = vi.fn();

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider tokenUpdateFn={mockUpdate}>
          {children}
        </AuthProvider>
      )
    });

    // Simulate login
    await act(async () => {
      await result.current.login({ email: 'test@test.com', password: '123' });
    });

    // Verify timer started
    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    expect(mockUpdate).toHaveBeenCalled();
  });

  // ✅ TEST: Timer stops after logout
  it('should stop refresh timer after logout', async () => {
    const mockUpdate = vi.fn();

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <AuthProvider tokenUpdateFn={mockUpdate}>
          {children}
        </AuthProvider>
      )
    });

    // Login first
    await act(async () => {
      await result.current.login({ email: 'test@test.com', password: '123' });
    });

    // Logout
    await act(async () => {
      result.current.logout();
    });

    // Timer should NOT call API
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000);
    });

    // Only called once during login, not after logout
    expect(mockUpdate).toHaveBeenCalledTimes(0);
  });
});
```

---

## 6. What We're NOT Testing (YAGNI)

### ❌ Skip These:
1. **Timer precision testing** (±1s doesn't matter)
2. **localStorage API itself** (browser feature, not our bug)
3. **Multiple tab synchronization** (not in requirements)
4. **Token expiration validation** (backend's job)
5. **Cookie parsing** (service responsibility)
6. **Fingerprint generation** (separate utility)

---

## 7. Test Coverage Goals

### Minimum Coverage:
- **useTokenRefresh hook**: 85% (essential logic)
- **AuthContext integration**: 70% (happy paths + logout)
- **Total Frontend**: ~60% (focused on critical paths)

### Why Not 80%+?
- Timer logic is simple (setInterval wrapper)
- Most edge cases handled by backend
- KISS: test what breaks, skip what's obvious

---

## 8. Mock Implementation Examples

### tokenRefreshService Mock
```typescript
// __mocks__/token-refresh.service.ts
export const tokenRefreshService = {
  updateToken: vi.fn().mockResolvedValue({
    success: true,
    newToken: 'mocked-token'
  }),

  syncSession: vi.fn().mockResolvedValue({
    refreshToken: 'synced-token',
    fingerprint: 'synced-fp',
    cookies: 'synced-cookies'
  })
};
```

### localStorage Mock Utility
```typescript
// test-utils/localStorage.mock.ts
export const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
};
```

---

## 9. Test Execution

### Run Commands
```bash
# Run all token refresh tests
npm run test -- token-refresh

# Run with coverage
npm run test -- token-refresh --coverage

# Watch mode during development
npm run test -- token-refresh --watch
```

---

## 10. Critical Things That MUST Work

### ✅ Must Test:
1. Timer calls API after 25 min ← **CORE FEATURE**
2. localStorage updates with new token ← **DATA PERSISTENCE**
3. Timer cleanup on unmount ← **MEMORY LEAK PREVENTION**
4. Logout on API error/logout flag ← **SECURITY**
5. No timer if no refreshToken ← **DEFENSIVE CODING**

### ⚠️ Critical Failures to Prevent:
- **Memory leak** from timer not clearing
- **Duplicate API calls** from multiple timers
- **App crash** on network failure
- **Session stuck** if logout flag ignored
- **Timer runs forever** if logout not called

---

## 11. Test Writing Guidelines

### DO:
- ✅ Use `vi.useFakeTimers()` for timer tests
- ✅ Test observable behavior (API calls, localStorage, logout)
- ✅ Mock at service boundary (tokenRefreshService)
- ✅ Test critical edge cases only
- ✅ Clear mocks between tests

### DON'T:
- ❌ Test internal state of hooks
- ❌ Test browser APIs (setInterval, localStorage)
- ❌ Test implementation details
- ❌ Over-test simple wrappers
- ❌ Test non-critical edge cases

---

## 12. Acceptance Criteria for Tests

### Tests Pass When:
1. All 5 essential tests green ✅
2. 2 critical edge cases covered ✅
3. 2 integration tests pass ✅
4. No console errors in test output ✅
5. Coverage > 60% on tested files ✅

### Ready to Ship When:
- Timer works in real browser (manual test)
- API calls visible in Network tab (manual test)
- localStorage updates correctly (manual test)
- Logout redirects properly (manual test)

---

## 13. Implementation Notes

### File: `useTokenRefresh.hook.tsx`
```typescript
// Expected signature for testing
export const useTokenRefresh = ({
  updateToken,
  refreshToken,
  fingerprint,
  onLogout
}: UseTokenRefreshProps) => {
  // Implementation
};
```

### Dependencies to Install
```bash
pnpm add -D @testing-library/react-hooks
```

### Vitest Config
```typescript
// vitest.config.ts - ensure this is present
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test-setup.ts']
  }
});
```

---

## 14. Questions Resolved

### Q1: ¿Cómo mockear setInterval básico?
**A**: `vi.useFakeTimers()` + `vi.advanceTimersByTime(ms)`

### Q2: ¿Cómo mockear fetch/API call?
**A**: Mock the service at boundary: `vi.mock('@/common/services/token-refresh.service')`

### Q3: ¿Cómo mockear localStorage?
**A**: `vi.spyOn(Storage.prototype, 'setItem')` or global mock

### Q4: ¿Hay algún edge case CRÍTICO?
**A**: Yes, 2 critical ones:
1. Network failure (app must not crash)
2. Multiple timers (memory leak prevention)

### Q5: ¿Qué podría romper la app si no lo testeamos?
**A**:
- Memory leak (timer not cleaned)
- Session stuck (logout flag ignored)
- Duplicate API calls (multiple timers)

---

## 15. Final Checklist

Before marking tests as complete:

- [ ] 5 essential tests implemented
- [ ] 2 critical edge cases covered
- [ ] 2 AuthContext integration tests
- [ ] All tests passing
- [ ] No console errors
- [ ] Coverage > 60%
- [ ] Manual smoke test in browser
- [ ] Timer visible in dev tools

---

## Summary

**Total Tests**: ~10 tests (not 50+)
**Focus**: Core functionality + critical failures
**Philosophy**: KISS - test what breaks, skip what's obvious
**Time**: ~2-3 hours to write + run

This is the MINIMAL viable test suite that gives confidence without over-engineering.