# Testing Plan - Executive Summary

**Document**: Comprehensive Testing Plan for Code Cleanup Phase
**Location**: `.claude/doc/code_cleanup/testing-plan.md`
**Status**: READY FOR REVIEW

---

## Current State

### 🔴 Critical Issues
- **Zero tests exist** in the codebase
- **Zero test coverage** (0%)
- **No testing infrastructure** configured
- **High risk** for regression during refactoring

### 📊 Codebase Statistics
- Total TypeScript files: ~112
- Module files: 64 (auth, booking, prebooking, boxes)
- Hooks: 11
- Components: 15
- Services: ~20
- Utilities: 7

---

## Recommended Approach

### Timeline Overview
**Total Estimated Time**: 17-25 hours (3-4 weeks part-time)

### Phase Breakdown

| Phase | Focus Area | Time | Priority | Coverage Gain |
|-------|-----------|------|----------|---------------|
| **Phase 0** | Setup Infrastructure | 2-3h | 🔴 Critical | 0% → 0% |
| **Phase 1** | Critical Paths | 5-7h | 🔴 Critical | 0% → 60% |
| **Phase 2** | Service Layer | 4-6h | 🟡 High | 60% → 75% |
| **Phase 3** | Integration | 3-4h | 🟡 High | 75% → 80% |
| **Phase 4** | Edge Cases | 2-3h | 🟢 Medium | 80% → 85% |
| **Phase 5** | Visual Regression | 1-2h | 🟢 Low | - |

---

## What Gets Tested (Phase 1 - Critical)

### 🔐 Authentication (2-3h)
- ✓ Login flow (valid/invalid credentials)
- ✓ Rate limiting
- ✓ Session management
- ✓ Token refresh
- ✓ Logout flow
- **Files**: 3 test files, ~30 test cases

### 📅 Booking (3-4h)
- ✓ Fetch bookings
- ✓ Create booking
- ✓ Cancel booking
- ✓ Business logic validation
- ✓ Cache management
- ✓ State management (Context + Hook)
- ✓ Utility functions
- **Files**: 6 test files, ~60 test cases

### ⏰ Prebooking Scheduler (2-3h)
- ✓ Create prebooking
- ✓ FIFO execution
- ✓ Race condition prevention
- ✓ Success/failure handling
- **Files**: 2 test files, ~20 test cases

**Phase 1 Total**: ~110 test cases, 11 test files

---

## Infrastructure Setup (Phase 0)

### Dependencies to Install
```bash
npm install -D \
  vitest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  @vitejs/plugin-react \
  jsdom \
  msw \
  @vitest/coverage-v8
```

### Files to Create
1. `/vitest.config.ts` - Vitest configuration
2. `/tests/setup.ts` - Global test setup
3. `/tests/utils/test-utils.tsx` - Custom render function
4. `/tests/utils/mock-factories.ts` - Mock data factories
5. `/tests/mocks/handlers.ts` - MSW API mocks
6. `/tests/mocks/server.ts` - MSW server setup

### Scripts to Add
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage",
  "test:watch": "vitest --watch"
}
```

---

## Coverage Targets

### By Module

| Module | Target | Rationale |
|--------|--------|-----------|
| Auth Services | 90% | Critical for security |
| Booking Services | 90% | Core business logic |
| Booking Business | 85% | Complex validation |
| Booking Utils | 95% | Pure functions |
| Prebooking Services | 85% | Background jobs |
| Boxes Services | 85% | User management |
| API Routes | 75% | Integration layer |
| UI Components | 70% | Visual testing |

### Overall Project Target
**Minimum**: 80% coverage before refactoring

---

## Test File Organization

```
/modules
  /auth
    /api/services/__tests__/
    /hooks/__tests__/
    /pods/login/__tests__/

  /booking
    /api/services/__tests__/
    /business/__tests__/
    /hooks/__tests__/
    /utils/__tests__/
    /pods/booking-dashboard/__tests__/

  /prebooking
    /api/services/__tests__/
    /business/__tests__/
    /hooks/__tests__/

  /boxes
    /api/services/__tests__/
    /hooks/__tests__/

/app/api
  /auth/aimharder/__tests__/
  /booking/__tests__/
  /prebooking/__tests__/

/core
  /database/__tests__/
  /api/__tests__/

/tests
  /setup.ts
  /utils/
  /mocks/
```

---

## Critical Success Factors

### Before Starting Refactoring
- [ ] Phase 0 complete (infrastructure setup)
- [ ] Phase 1 complete (critical paths tested)
- [ ] Coverage ≥ 60%
- [ ] All tests passing
- [ ] CI/CD pipeline configured

### Safe to Refactor When
- [ ] Coverage ≥ 80%
- [ ] All critical paths tested
- [ ] Zero test failures
- [ ] Visual regression baseline established
- [ ] Team trained on running tests

---

## Key Testing Principles

### ✅ DO
- Test user-visible behavior
- Use semantic queries (role, label, text)
- Mock at service boundaries
- Wait for async operations
- Keep tests isolated
- Test error states
- Test loading states

### ❌ DON'T
- Test implementation details
- Test internal state
- Use fragile selectors (classes, IDs)
- Share state between tests
- Test third-party code
- Skip async waits
- Copy-paste tests

---

## Risks & Mitigation

### High Risk Areas
1. **Auth Flow** - Test session management, rate limiting thoroughly
2. **Booking Race Conditions** - Test concurrent booking attempts
3. **Prebooking FIFO** - Test ordering with staggered execution
4. **Token Refresh** - Test background refresh timing

### Mitigation Strategy
- Write tests for these areas FIRST
- Use integration tests to verify end-to-end flows
- Add stress tests for concurrent scenarios
- Mock timing carefully with fake timers

---

## Questions for Team

### Infrastructure
1. Should tests run in CI/CD? (Recommended: **Yes**)
2. Block deployment on test failures? (Recommended: **Yes**)
3. Generate coverage reports? (Recommended: **Yes**)

### Strategy
1. Test API routes as integration or unit? (Recommended: **Both**)
2. Mock external APIs? (Recommended: **MSW**)
3. Priority: Coverage % or critical paths? (Recommended: **Critical paths first**)

### Execution
1. Pause development for setup? (Recommended: **Yes, 1 week**)
2. Fix bugs before testing? (Recommended: **No, tests will find them**)
3. When to start refactoring? (Recommended: **After 70% coverage**)

---

## Next Actions

### Immediate (Today)
1. ✅ Review this summary
2. ✅ Review detailed plan in `testing-plan.md`
3. ⏳ Answer clarification questions
4. ⏳ Get approval to proceed

### This Week
1. ⏳ Phase 0: Setup infrastructure (2-3 hours)
2. ⏳ Install dependencies
3. ⏳ Create test utilities
4. ⏳ Configure Vitest

### Next Week
1. ⏳ Phase 1.1: Auth tests (2-3 hours)
2. ⏳ Phase 1.2: Booking tests (3-4 hours)
3. ⏳ Target: 60% coverage

### Week 3
1. ⏳ Phase 1.3: Prebooking tests (2-3 hours)
2. ⏳ Phase 2: Service layer (4-6 hours)
3. ⏳ Target: 75% coverage

### Week 4
1. ⏳ Phase 3: Integration tests (3-4 hours)
2. ⏳ Phase 4 & 5: Polish (3-5 hours)
3. ⏳ Target: 80%+ coverage
4. ✅ READY FOR REFACTORING

---

## Files to Read

1. **Main Plan**: `.claude/doc/code_cleanup/testing-plan.md` (Detailed)
2. **This Summary**: `.claude/doc/code_cleanup/testing-summary.md` (Quick ref)

---

**Prepared By**: Frontend Test Engineer Agent
**Date**: 2025-10-04
**Status**: AWAITING TEAM REVIEW
