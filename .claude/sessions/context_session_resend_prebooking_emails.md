# Resend Email Integration for Prebooking Notifications

## Overview
Integrating Resend email service to send notifications when users book classes via prebooking system.

## Requirements Analysis

### Email de Éxito (Success Email)
**Recipient:** User + Admin (alexsbd1@gmail.com)
**Content:**
- Nombre de la clase
- Fecha y hora de la clase
- Entrenador
- Ubicación
- **Timestamp exacto:** HH:MM:SS:ms (ej: 20:30:00:500)

**Design:** Template amigable, colores de la app actual

### Email de Fallo (Failure Email)
**Recipient:** User + Admin (alexsbd1@gmail.com)
**Content:**
- Mismo contenido que success
- Razón del fallo
- Recomendación de apuntarse manualmente (sin link)

**Possible Failure Reasons:**
- Session not found
- Session expired
- Token refresh failed
- Booking error from AimHarder
- Class full
- Other validation errors

### Configuration
- **From:** aimwodbot@alexmarcos.dev
- **API Key:** re_UaDFGvSH_N3Fw9ujVvszb6mZabqgXoudr
- **Domain:** Verified ✅

## Current Implementation Context

### Webhook Endpoint
**File:** `app/api/execute-prebooking/route.ts`
**Purpose:** Executes prebooking at exact time using QStash

**Key Points:**
- Receives webhook 5 seconds before class starts
- Fires booking request at exact millisecond (execute_at timestamp)
- Updates prebooking status (pending → completed/failed)
- Handles token refresh if needed
- Current error handling: Logs only, no email notifications

**Integration Points for Email:**
1. **Success Path:** Line 599 (markCompleted)
2. **Failure Path:** Lines 170, 289, 326, 534, 660 (markFailed)

### Prebooking Service Methods
- `preBookingService.markCompleted(prebookingId, {...})`
- `preBookingService.markFailed(prebookingId, reason, details)`

### Available Data in Webhook
```
{
  prebookingId: string
  boxSubdomain: string
  boxAimharderId: string
  executeAt: string // Unix timestamp (ms)
  formattedDateTime: string // "15/11/2025 19:30"
  userEmail: string
  classType: string
}
```

## Implementation Plan (Phase 1)

### Subagents Consultation
- [ ] **ui-ux-analyzer:** Review email template design & branding
- [ ] **nextjs-architect:** Review email service architecture in Next.js context

### Tasks
1. Create Resend email service (`modules/shared/api/services/resend.service.ts`)
2. Create email templates (success & failure)
   - Success template component
   - Failure template component
3. Update execute-prebooking route to send emails on success/failure
4. Add error handling for email failures (don't block booking)
5. Testing & validation

## Requirements Clarification - FINALIZED ✅

### 1. Timestamp Information in Failure Email
**For traceability:** Show exact times in failure email
- Preparation time: cuando se recibe la petición
- Launch time: cuando se lanza a AimHarder
- Response time: cuando se recibe la respuesta de AimHarder

Example message: "Nos hemos preparado para enviar la petición a [HH:MM:SS] y hemos lanzado tu reserva a las [HH:MM:SS] y aimharder nos la ha confirmado a las [HH:MM:SS]"

**For Success Email:** Just show timestamp of when booked

### 2. Trainer & Location
For first iteration: NO needed - just classType and formattedDateTime

### 3. Box Name
- Table in Supabase: `boxes` (has name field)
- Strategy: ADD box name to QStash webhook body to avoid queries
- For now: Include in webhook params if available, or skip

### 4. Performance
- **NO additional queries** in webhook
- All data must come from webhook params or immediate response

### 5. Admin Email (Failure Only)
**Should include ALL relevant traceability data:**
- execution ID
- fire latency
- error code/message from AimHarder
- preparation → launch → response timestamps
- user email
- class info
- Everything needed to trace what happened

## Next Steps

### Phase 1: Implement Email Service
1. Install dependencies: `pnpm add resend @react-email/components`
2. Create email service + types
3. Create email templates (success & failure)
4. Integrate into webhook (6 locations)

### Phase 2: Update QStash Webhook Body (OPTIONAL)
- Add box name to prebooking webhook params to avoid queries

## Implementation Complete ✅

### Files Created
1. **`common/services/email/email.types.ts`** - TypeScript types for email data
2. **`common/services/email/email.service.ts`** - Resend email service with lazy initialization
3. **`common/services/email/templates/prebooking-success.tsx`** - Success email template (React Email)
4. **`common/services/email/templates/prebooking-failure.tsx`** - Failure email template (React Email)
5. **`common/services/email/email.service.test.ts`** - Unit tests for email service

### Files Modified
1. **`app/api/execute-prebooking/route.ts`** - Added email integrations at 6 points:
   - Line ~189: Session not found error
   - Line ~325: Session expired error
   - Line ~376: Token refresh failed error
   - Line ~607: Booking service error
   - Line ~705: Success notification
   - Line ~771: Booking failed (AimHarder error)

### Key Features Implemented

#### Success Email (User Only)
- ✅ Class name, date/time
- ✅ Confirmation timestamp
- ✅ Box name (if available)
- ✅ User-friendly message
- ✅ Responsive design with app branding colors

#### Failure Email (User + Admin)
- ✅ Class info
- ✅ Error message (user-friendly for customer)
- ✅ Recommendation to book manually
- ✅ Technical traceability for admin:
  - Execution ID
  - Preparation → Launch → Response timeline
  - Fire latency
  - AimHarder response details
  - Error codes and messages
  - Response times

### Design Decisions
- **Non-blocking**: Email failures don't interrupt booking process
- **Lazy Resend initialization**: Avoids build-time errors
- **Template components**: React Email for type-safe templates
- **Admin-only failure emails**: Success emails only to user
- **Spanish language**: All emails in Spanish as requested
- **Branding**: Primary color (#7c3aed) from app theme

### Environment Variables Required
```env
RESEND_API_KEY=re_UaDFGvSH_N3Fw9ujVvszb6mZabqgXoudr
RESEND_FROM_EMAIL=aimwodbot@alexmarcos.dev
ADMIN_EMAIL=alexsbd1@gmail.com
```

## Phase 2: QStash Webhook Enhancement ✅ COMPLETE

### Files Modified for Box Name Integration
1. **`core/qstash/client.ts`**
   - Updated `boxData` parameter type to include optional `name` field
   - Added `boxName: boxData.name` to QStash webhook payload

2. **`app/api/booking/route.ts`**
   - Updated `schedulePrebookingExecution()` call to pass `name: box.name` in boxData parameter

3. **`app/api/execute-prebooking/route.ts`**
   - Added `boxName?: string` to WebhookBody interface
   - Added boxName destructuring from webhook payload
   - Updated all 6 email calls to include `boxName: boxName || undefined`
   - Backward compatible: uses `|| undefined` for old webhooks without boxName

### Integration Points Updated with boxName
1. ✅ Line ~189: Session not found error - boxName added
2. ✅ Line ~326: Session expired error - boxName added
3. ✅ Line ~378: Token refresh failed error - boxName added
4. ✅ Line ~608: Booking service error - boxName added
5. ✅ Line ~714: Success email notification - boxName added
6. ✅ Line ~782: AimHarder failure response - boxName added

### Build Status
✅ **Build Successful** - All TypeScript changes verified with `pnpm build`

### Next Steps (Optional)
1. **Test with real emails** - Use Resend dashboard to verify sends
2. **Set up email monitoring** - Monitor deliverability and bounces
3. **Add retry logic** - If more sophisticated error handling needed

## Progress Log
- [x] Read execute-prebooking route
- [x] Understand current webhook structure
- [x] Identify integration points
- [x] Get Next.js architect feedback
- [x] Clarify all requirements
- [x] Install dependencies
- [x] Create email service
- [x] Create templates
- [x] Update webhook route (6 points)
- [x] Create unit tests
- [x] Build successfully
- [x] Documentation complete
- [x] Add box name to QStash webhook
- [x] Integrate boxName into all 6 email calls
- [x] Verify build compiles successfully
