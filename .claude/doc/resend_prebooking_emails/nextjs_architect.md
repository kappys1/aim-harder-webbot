# Resend Email Integration - Architecture Plan

## 1. File Structure

```
common/
└── services/
    └── email/
        ├── email.service.ts          # Main Resend service
        ├── email.types.ts            # TypeScript interfaces
        └── templates/
            ├── prebooking-success.tsx  # React Email template
            └── prebooking-failure.tsx  # React Email template
```

## 2. Environment Variables

```env
RESEND_API_KEY=re_UaDFGvSH_N3Fw9ujVvszb6mZabqgXoudr
RESEND_FROM_EMAIL=aimwodbot@alexmarcos.dev
ADMIN_EMAIL=alexsbd1@gmail.com
```

## 3. TypeScript Interfaces

```typescript
// email.types.ts
export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface PrebookingEmailData {
  userEmail: string;
  userName?: string;
  classType: string;
  formattedDateTime: string;
  boxName?: string;
}

export interface PrebookingSuccessData extends PrebookingEmailData {
  bookingId?: string;
  alreadyBookedManually?: boolean;
}

export interface PrebookingFailureData extends PrebookingEmailData {
  errorMessage: string;
  errorCode?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

## 4. Email Service Implementation

```typescript
// email.service.ts
import { Resend } from 'resend';
import { PrebookingSuccessEmail } from './templates/prebooking-success';
import { PrebookingFailureEmail } from './templates/prebooking-failure';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'aimwodbot@alexmarcos.dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'alexsbd1@gmail.com';

export class EmailService {
  /**
   * Send prebooking success notification
   * Non-blocking - errors are logged but don't throw
   */
  static async sendPrebookingSuccess(data: PrebookingSuccessData): Promise<EmailResult> {
    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: [data.userEmail, ADMIN_EMAIL],
        subject: `Reserva confirmada: ${data.classType} - ${data.formattedDateTime}`,
        react: PrebookingSuccessEmail(data),
      });

      console.log(`[EMAIL] Success notification sent to ${data.userEmail}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      console.error('[EMAIL] Failed to send success notification:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send prebooking failure notification
   * Non-blocking - errors are logged but don't throw
   */
  static async sendPrebookingFailure(data: PrebookingFailureData): Promise<EmailResult> {
    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: [data.userEmail, ADMIN_EMAIL],
        subject: `Error en reserva: ${data.classType} - ${data.formattedDateTime}`,
        react: PrebookingFailureEmail(data),
      });

      console.log(`[EMAIL] Failure notification sent to ${data.userEmail}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      console.error('[EMAIL] Failed to send failure notification:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
```

## 5. React Email Templates

### Success Template
```tsx
// templates/prebooking-success.tsx
import { Html, Head, Body, Container, Text, Heading } from '@react-email/components';

export function PrebookingSuccessEmail(data: PrebookingSuccessData) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', padding: '20px' }}>
        <Container>
          <Heading>Reserva Confirmada</Heading>
          <Text>Tu reserva ha sido realizada con exito.</Text>
          <Text><strong>Clase:</strong> {data.classType}</Text>
          <Text><strong>Fecha y hora:</strong> {data.formattedDateTime}</Text>
          {data.alreadyBookedManually && (
            <Text style={{ color: '#666' }}>
              Nota: Ya habias reservado manualmente esta clase.
            </Text>
          )}
        </Container>
      </Body>
    </Html>
  );
}
```

### Failure Template
```tsx
// templates/prebooking-failure.tsx
import { Html, Head, Body, Container, Text, Heading } from '@react-email/components';

export function PrebookingFailureEmail(data: PrebookingFailureData) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', padding: '20px' }}>
        <Container>
          <Heading style={{ color: '#dc2626' }}>Error en Reserva</Heading>
          <Text>No se pudo completar tu reserva automatica.</Text>
          <Text><strong>Clase:</strong> {data.classType}</Text>
          <Text><strong>Fecha y hora:</strong> {data.formattedDateTime}</Text>
          <Text><strong>Error:</strong> {data.errorMessage}</Text>
          <Text style={{ marginTop: '20px' }}>
            Por favor, intenta reservar manualmente en AimHarder.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

## 6. Webhook Integration

In `app/api/execute-prebooking/route.ts`, add after status updates:

### Success case (after line 630):
```typescript
// Send success email (non-blocking)
EmailService.sendPrebookingSuccess({
  userEmail,
  classType,
  formattedDateTime,
  bookingId: bookingResponse.id,
  alreadyBookedManually: mappedResult.alreadyBookedManually,
}).catch(err => console.error('[HYBRID] Email send error:', err));
```

### Failure cases (multiple locations):
```typescript
// Send failure email (non-blocking)
EmailService.sendPrebookingFailure({
  userEmail: parsedBody?.userEmail || 'unknown',
  classType: parsedBody?.classType || 'unknown',
  formattedDateTime: parsedBody?.formattedDateTime || 'unknown',
  errorMessage: 'Session not found',
}).catch(err => console.error('[HYBRID] Email send error:', err));
```

## 7. Integration Points in Webhook

Add email notifications at these locations in `route.ts`:

| Line | Scenario | Email Type |
|------|----------|------------|
| ~185 | Session not found | Failure |
| ~305 | Session expired | Failure |
| ~345 | Token refresh failed | Failure |
| ~545 | Booking service error | Failure |
| ~630 | Booking success | Success |
| ~680 | Booking failed (AimHarder error) | Failure |

## 8. Design Decisions

### No Retry Logic
- Email failures should NOT retry (would delay response)
- Log errors for monitoring
- Consider separate queue for retries if needed later

### Non-Blocking Pattern
```typescript
// Fire-and-forget with error logging
EmailService.sendPrebookingSuccess(data)
  .catch(err => console.error('[EMAIL]', err));
```

### Why React Email
- Type-safe templates
- Reusable components
- Better DX than HTML strings
- Easy to test/preview

## 9. Dependencies

```bash
pnpm add resend @react-email/components
```

## 10. Testing Strategy

```typescript
// email.service.test.ts
describe('EmailService', () => {
  it('should send success email without throwing', async () => {
    const result = await EmailService.sendPrebookingSuccess(mockData);
    expect(result.success).toBe(true);
  });

  it('should handle Resend errors gracefully', async () => {
    // Mock Resend to throw
    const result = await EmailService.sendPrebookingSuccess(mockData);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

## 11. Clarifications Needed

1. **Box name in emails?** - Should emails include the gym/box name? Currently not available in webhook body.
2. **User name?** - Should we fetch user name from DB for personalized emails?
3. **Email language?** - Spanish only or also English based on user preference?
4. **Admin notification filtering?** - Should admin receive ALL emails or only failures?

## 12. Implementation Order

1. Install dependencies: `pnpm add resend @react-email/components`
2. Add environment variables to `.env.local`
3. Create `common/services/email/email.types.ts`
4. Create `common/services/email/email.service.ts`
5. Create success template
6. Create failure template
7. Integrate into webhook (6 locations)
8. Test manually with prebooking
9. Add unit tests
