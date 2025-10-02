# Loading State Flow Analysis

## Current Broken Flow (Why Loading Never Shows)

### Scenario 1: Fresh API Call (BROKEN)
```
User Action: Changes date
    ↓
1. useEffect triggers fetchBookings(false)
    ↓
2. actions.setLoading(true)          ← isLoading: true  (batched)
    ↓
3. await apiCall()                   ← API call starts
    ↓
4. API returns data
    ↓
5. actions.setCurrentDay(data)       ← isLoading: false (batched - reducer auto-sets)
    ↓
6. actions.setLoading(false)         ← isLoading: false (redundant, still batched)
    ↓
React renders ONCE with: isLoading: false ❌
(Loading skeleton never visible!)
```

### Scenario 2: Cached Data (EVEN MORE BROKEN)
```
User Action: Changes date
    ↓
1. useEffect triggers fetchBookings(false)
    ↓
2. Cache hit detected
    ↓
3. actions.setCurrentDay(cachedData) ← isLoading: false (never was true!)
    ↓
4. return early
    ↓
React renders with: isLoading: false ❌
(Loading state NEVER set at all!)
```

## Fixed Flow (What Should Happen)

### Scenario 1: Fresh API Call (FIXED)
```
User Action: Changes date
    ↓
1. useEffect triggers fetchBookings(false)
    ↓
2. actions.setLoading(true)          ← isLoading: true
    ↓
React renders: Loading skeleton visible ✅
    ↓
3. await apiCall()                   ← API call in progress
    ↓
4. API returns data
    ↓
5. actions.setCurrentDay(data)       ← Updates data (no longer touches loading)
    ↓
6. actions.setLoading(false)         ← isLoading: false
    ↓
React renders: Data displayed ✅
```

### Scenario 2: Cached Data (FIXED)
```
User Action: Changes date
    ↓
1. useEffect triggers fetchBookings(false)
    ↓
2. Cache hit detected
    ↓
3. actions.setLoading(true)          ← isLoading: true (NEW!)
    ↓
React renders: Loading skeleton visible ✅
    ↓
4. setTimeout(() => {
     actions.setCurrentDay(cachedData)
     actions.setLoading(false)
   }, 0)                             ← Breaks React batching
    ↓
React renders: Data displayed ✅
```

## State Transitions

### Current (Broken)
```
Component Mount:
[false] → (batched: [true, false]) → [false]
         ^
         Only this renders!

Date Change (cached):
[false] → [false]
         ^
         Never changes!
```

### Fixed
```
Component Mount:
[false] → [true] → [false]
          ^        ^
    Skeleton    Data

Date Change (cached):
[false] → [true] → [false]
          ^        ^
    Skeleton    Data
```

## React 18 Batching Behavior

### Automatic Batching (Current Issue)
```javascript
// All these updates batch together:
function handleClick() {
  setLoading(true);     // Batch 1
  setData(newData);     // Batch 2
  setLoading(false);    // Batch 3
  // Result: Component renders ONCE with final state
}

// Same happens with async:
async function fetchData() {
  setLoading(true);         // Batch 1
  const data = await api(); // (await doesn't break batching in React 18!)
  setLoading(false);        // Batch 2
  // Result: Component renders ONCE with final state
}
```

### Breaking Batching (Our Fix)
```javascript
// setTimeout breaks batching:
function updateWithLoading() {
  setLoading(true);
  // Component renders with loading=true

  setTimeout(() => {
    setData(newData);
    setLoading(false);
    // Component renders again with loading=false
  }, 0);
}
```

## Reducer State Management

### Current (Violates SRP)
```typescript
case "SET_CURRENT_DAY":
  return {
    ...state,
    currentDay: action.payload,
    isLoading: false,  // ❌ Side effect!
    error: null,
  };
```

**Problems:**
- ❌ SET_CURRENT_DAY does TWO things (set data + manage loading)
- ❌ Implicit loading state management
- ❌ Makes setLoading(false) redundant
- ❌ Tight coupling between data and loading

### Fixed (Follows SRP)
```typescript
case "SET_CURRENT_DAY":
  return {
    ...state,
    currentDay: action.payload,
    // ✅ REMOVED: isLoading: false
    error: null,
  };
```

**Benefits:**
- ✅ SET_CURRENT_DAY does ONE thing (set data)
- ✅ Explicit loading state management
- ✅ Clear separation of concerns
- ✅ Easier to debug and test

## Cache Flow Comparison

### Before (Broken)
```
┌─────────────────┐
│  fetchBookings  │
└────────┬────────┘
         │
    Check cache
         │
    ┌────┴────┐
    │         │
   Yes       No
    │         │
    │    setLoading(true)
    │         │
    │    API call
    │         │
Set data    Set data + cache
    │         │
    └────┬────┘
         │
    isLoading = false
    (from reducer)
         │
    Render ❌
```

### After (Fixed)
```
┌─────────────────┐
│  fetchBookings  │
└────────┬────────┘
         │
    Check cache
         │
    ┌────┴────┐
    │         │
   Yes       No
    │         │
    │    setLoading(true)
    │         │
setLoading   API call
  (true)      │
    │    Set data + cache
    │         │
setTimeout   setLoading(false)
    │         │
Set data     └────┬────┘
    │              │
setLoading(false) Render ✅
    │
Render ✅
```

## Timeline Analysis

### Broken Timeline (Cached Data)
```
Time: 0ms
Event: User changes date
State: isLoading=false

Time: 1ms
Event: Cache hit, setCurrentDay()
State: isLoading=false (never changed)

Time: 2ms
Event: Component re-renders
Result: No loading state shown ❌
```

### Fixed Timeline (Cached Data)
```
Time: 0ms
Event: User changes date
State: isLoading=false

Time: 1ms
Event: Cache hit, setLoading(true)
State: isLoading=true

Time: 2ms
Event: Component re-renders
Result: Loading skeleton visible ✅

Time: 3ms (next tick)
Event: setTimeout executes, setCurrentDay() + setLoading(false)
State: isLoading=false, data updated

Time: 4ms
Event: Component re-renders
Result: Data displayed ✅
```

## Key Takeaways

### Root Causes
1. **Cached data path never sets loading state** - Most critical issue
2. **Reducer auto-sets isLoading=false** - Violates SRP
3. **React 18 batching** - Batches multiple updates
4. **Synchronous execution** - No time for React to render

### Solutions
1. **Remove auto-loading from reducer** - Follows SRP
2. **Add loading state for cached data** - Consistency
3. **Use setTimeout(fn, 0)** - Breaks React batching
4. **Fix useEffect deps** - Prevents stale closures

### Testing Strategy
1. **Test state transitions** - Verify all paths show loading
2. **Test React batching** - Ensure loading is visible
3. **Test cached vs. fresh data** - Both should show loading
4. **Test race conditions** - Rapid changes handled correctly

## Implementation Checklist

### Code Changes
- [ ] Remove `isLoading: false` from `SET_CURRENT_DAY` reducer
- [ ] Add `setLoading(true)` to cached data path
- [ ] Wrap cached data update in `setTimeout(fn, 0)`
- [ ] Fix useEffect dependency array
- [ ] Update error handling to explicitly set loading=false

### Testing
- [ ] Write reducer tests (verify loading NOT touched)
- [ ] Write hook tests (verify loading for all paths)
- [ ] Write component tests (verify skeleton displays)
- [ ] Test React batching behavior
- [ ] Test race conditions

### Validation
- [ ] Loading skeleton shows for fresh API calls
- [ ] Loading skeleton shows for cached data
- [ ] No console errors
- [ ] No infinite loops
- [ ] Performance acceptable
