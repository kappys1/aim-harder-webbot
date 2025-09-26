# CrossFit Login Page Implementation Plan - shadcn/ui Architecture

## Executive Summary

This document provides a comprehensive implementation plan for creating a responsive, mobile-first login page for the AimHarder CrossFit class reservation app using shadcn/ui components. The design will be professionally themed for busy CrossFit athletes with excellent UX/UI.

## Project Context Analysis

- **Current State**: Fresh Next.js 15.5.4 project with TypeScript, TailwindCSS 4.x
- **Architecture**: App Router structure with feature-based organization
- **Dependencies**: Ready with @radix-ui components, react-hook-form, zod validation
- **Current Gap**: No shadcn/ui initialization, no components/ui structure

## Recommended Login Block Selection

After analyzing all 5 available login blocks, **login-02** is recommended for the CrossFit app:

### Why login-02?

- **Mobile-first design**: Clean, centered layout perfect for mobile athletes
- **Two-panel layout**: Professional split-screen design for desktop
- **GitHub OAuth pattern**: Easily adaptable for Google/Apple/other providers
- **No card wrapper**: Better for full-screen mobile experience
- **Direct form approach**: Streamlined for quick access

### Alternative Options Considered:

- **login-01**: Too card-heavy for mobile
- **login-03**: Over-engineered with too many OAuth options
- **login-04 & login-05**: Not analyzed but likely more complex

## Implementation Architecture

### 1. Project Structure Setup (Following CLAUDE.md Architecture)

```
app/
├── globals.css                    # Update with CrossFit theme
├── layout.tsx                     # Add metadata and viewport
├── page.tsx                       # Redirect to login
└── login/
    └── page.tsx                   # Main login page

components/
└── ui/                           # shadcn components
    ├── button.tsx
    ├── input.tsx
    ├── label.tsx
    └── card.tsx

lib/
└── utils.ts                      # Tailwind merge utilities

modules/
└── auth/                         # Auth feature module
    ├── api/
    │   ├── services/
    │   │   └── auth.service.ts   # API calls for authentication
    │   ├── mappers/
    │   │   └── auth.mapper.ts    # Data transformation between API and app models
    │   └── models/
    │       └── auth.api.ts       # API request/response models
    ├── business/
    │   └── auth.business.ts      # Business logic for authentication
    ├── pods/
    │   └── login/
    │       ├── login.container.tsx  # Server Component (data fetching)
    │       ├── login.component.tsx  # Client Component (UI interactions)
    │       ├── login.test.tsx       # Tests for the pod
    │       ├── components/
    │       │   └── login-form.tsx   # Login form component
    │       ├── models/
    │       │   └── login.model.ts   # Login schemas and types
    │       └── hooks/
    │           ├── useAuthContext.hook.tsx  # Auth context management
    │           └── useLogin.hook.tsx        # Login operations
    ├── models/
    │   └── auth.model.ts         # Shared auth data models and types
    ├── utils/
    │   └── auth.utils.ts         # Auth utility functions
    ├── constants/
    │   └── auth.constants.ts     # Auth constants (API endpoints, etc.)
    └── views/
        └── login-page.tsx        # Login page view component

core/
├── api/
│   └── client.ts                 # API client setup
├── auth/
│   └── context.tsx               # Global auth context
└── config/
    └── env.ts                    # Environment configurations

common/
├── components/
│   └── ui/                       # Shared UI components (if needed beyond shadcn)
├── hooks/
│   └── useLocalStorage.hook.ts   # Shared custom hooks
└── utils/
    └── validation.utils.ts       # Shared utility functions
```

### 2. File Creation/Modification Plan

#### Phase 1: Foundation Setup (Critical)

1. **Install shadcn/ui CLI and initialize project:**

   ```bash
   npx shadcn@latest init
   ```

   - Creates `components.json` config
   - Sets up import paths and styling

2. **Create utils utility (`lib/utils.ts`):**

   ```typescript
   import { clsx, type ClassValue } from "clsx"
   import { tailwind-merge } from "tailwind-merge"

   export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs))
   }
   ```

3. **Install required shadcn components:**
   ```bash
   npx shadcn@latest add button input label
   ```

#### Phase 2: CrossFit Theme Implementation (Critical)

**File: `app/globals.css`** - Complete rewrite with CrossFit theme:

```css
@import "tailwindcss";

:root {
  /* CrossFit Brand Colors - Primary Palette */
  --primary: 220 85% 20%; /* Deep Athletic Blue */
  --primary-foreground: 210 40% 98%;

  /* CrossFit Secondary Colors */
  --secondary: 25 95% 53%; /* Energy Orange */
  --secondary-foreground: 220 13% 91%;

  /* CrossFit Accent Colors */
  --accent: 142 76% 36%; /* Success Green */
  --accent-foreground: 355 7% 97%;

  /* Professional Grays */
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;

  /* Functional Colors */
  --destructive: 0 84% 60%; /* Error Red */
  --destructive-foreground: 210 40% 98%;

  /* Background System */
  --background: 0 0% 100%;
  --foreground: 220 13% 9%;

  /* Border & Input System */
  --border: 220 13% 91%;
  --input: 220 13% 91%;
  --ring: 220 85% 20%; /* Focus ring matches primary */

  /* Card System */
  --card: 0 0% 100%;
  --card-foreground: 220 13% 9%;

  /* Radius for CrossFit aesthetic */
  --radius: 0.5rem;
}

@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);

  /* Typography for Athletes - Strong & Clear */
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Dark theme for night training sessions */
    --primary: 220 85% 25%;
    --primary-foreground: 210 40% 98%;

    --secondary: 25 95% 48%;
    --secondary-foreground: 220 13% 91%;

    --accent: 142 76% 31%;
    --accent-foreground: 355 7% 97%;

    --muted: 220 13% 15%;
    --muted-foreground: 220 9% 60%;

    --destructive: 0 84% 55%;
    --destructive-foreground: 210 40% 98%;

    --background: 220 13% 9%;
    --foreground: 220 13% 91%;

    --border: 220 13% 15%;
    --input: 220 13% 15%;
    --ring: 220 85% 25%;

    --card: 220 13% 11%;
    --card-foreground: 220 13% 91%;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-feature-settings: "rlig" 1, "calt" 1;
}

/* CrossFit-specific utility classes */
.crossfit-container {
  max-width: 480px; /* Mobile-optimized for athletes on-the-go */
  margin: 0 auto;
  padding: 1.5rem;
}

.crossfit-hero-bg {
  background: linear-gradient(
    135deg,
    hsl(var(--primary)) 0%,
    hsl(var(--secondary)) 100%
  );
}

.crossfit-glass {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Dark mode glass effect */
@media (prefers-color-scheme: dark) {
  .crossfit-glass {
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
}
```

#### Phase 3: Login Page Implementation (Critical)

**File: `app/login/page.tsx`** - Next.js page routing to auth module:

```typescript
import { LoginContainer } from "@/modules/auth/pods/login/login.container";

export const metadata = {
  title: "Login - AimHarder CrossFit",
  description: "Access your CrossFit class reservations",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function LoginPage() {
  return <LoginContainer />;
}
```

**File: `modules/auth/pods/login/login.container.tsx`** - Server Component for data fetching:

```typescript
import { LoginComponent } from "./login.component";

export async function LoginContainer() {
  // Server-side data fetching if needed (e.g., OAuth providers config)
  // const oauthProviders = await getOAuthProviders()

  return (
    <LoginComponent
    // oauthProviders={oauthProviders}
    />
  );
}
```

**File: `modules/auth/pods/login/login.component.tsx`** - Client Component with UI interactions:

```typescript
"use client";

import { DumbbellIcon } from "lucide-react";
import { LoginForm } from "./components/login-form";

interface LoginComponentProps {
  // oauthProviders?: OAuthProvider[]
}

export function LoginComponent({}: LoginComponentProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Form Section - Mobile First */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Brand Header */}
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
              <DumbbellIcon className="size-5" />
            </div>
            AimHarder
          </a>
        </div>

        {/* Centered Form */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* Hero Section - Hidden on Mobile */}
      <div className="crossfit-hero-bg relative hidden lg:flex items-center justify-center">
        <div className="text-center text-white max-w-md p-8">
          <h2 className="text-3xl font-bold mb-4">Book Your Next WOD</h2>
          <p className="text-white/90 text-lg leading-relaxed">
            Automatically reserve your spot in CrossFit classes. Never miss a
            workout again.
          </p>
        </div>
        {/* Optional: Add CrossFit image overlay */}
        <div className="absolute inset-0 bg-black/20" />
      </div>
    </div>
  );
}
```

**File: `modules/auth/pods/login/components/login-form.tsx`** - Form component following pod structure:

```typescript
import { cn } from "@/lib/utils";
import { Button } from "@/common/components/ui/button";
import { Input } from "@/common/components/ui/input";
import { Label } from "@/common/components/ui/label";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Welcome Back, Athlete</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Sign in to book your classes and track your progress
        </p>
      </div>

      {/* Form Fields */}
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="athlete@example.com"
            required
            className="h-12" // Larger touch targets for mobile
          />
        </div>

        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Password</Label>
            <a
              href="/forgot-password"
              className="ml-auto text-sm underline-offset-4 hover:underline text-primary"
            >
              Forgot password?
            </a>
          </div>
          <Input id="password" type="password" required className="h-12" />
        </div>

        {/* Primary CTA */}
        <Button type="submit" className="w-full h-12 text-base font-semibold">
          Sign In
        </Button>

        {/* Divider */}
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-2">
            Or continue with
          </span>
        </div>

        {/* OAuth Options - Optimized for Athletes */}
        <div className="grid gap-3">
          <Button variant="outline" className="w-full h-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="size-5"
            >
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            Continue with Google
          </Button>

          <Button variant="outline" className="w-full h-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="size-5"
            >
              <path
                d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                fill="currentColor"
              />
            </svg>
            Continue with Apple
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm">
        New to AimHarder?{" "}
        <a
          href="/signup"
          className="underline underline-offset-4 text-primary font-medium"
        >
          Create account
        </a>
      </div>
    </form>
  );
}
```

#### Phase 4: Authentication Hook (Business Logic)

**File: `modules/auth/pods/login/hooks/useLogin.hook.tsx`** - Login operations hook:

```typescript
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/modules/auth/api/services/auth.service";
import { LoginRequest } from "@/modules/auth/pods/login/models/login.model";

export function useLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (data: LoginRequest) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(data);

      if (response.success) {
        // Store token or handle auth state
        router.push("/dashboard");
      } else {
        setError(response.error || "Login failed");
      }
    } catch (err) {
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    setIsLoading(true);
    try {
      const response = await authService.oauthLogin(provider);

      if (response.success) {
        router.push("/dashboard");
      } else {
        setError(`Failed to login with ${provider}`);
      }
    } catch (err) {
      setError(`Failed to login with ${provider}`);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    handleLogin,
    handleOAuthLogin,
  };
}
```

**File: `modules/auth/pods/login/models/login.model.ts`** - Login schemas and types:

```typescript
import { z } from "zod";

// Zod schemas for validation
export const LoginRequestSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string().optional(),
    })
    .optional(),
  token: z.string().optional(),
  error: z.string().optional(),
});

// TypeScript types derived from schemas
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// Form state type
export interface LoginFormState {
  isSubmitting: boolean;
  error: string | null;
  fieldErrors: {
    email?: string;
    password?: string;
  };
}
```

**File: `modules/auth/api/services/auth.service.ts`** - Authentication API service:

```typescript
import { apiClient } from "@/core/api/client";
import {
  LoginRequest,
  LoginResponse,
} from "@/modules/auth/pods/login/models/login.model";
import { AuthMapper } from "../mappers/auth.mapper";
import {
  LoginApiRequest,
  LoginApiResponse,
  OAuthApiResponse,
} from "../models/auth.api";

class AuthService {
  async login(request: LoginRequest): Promise<LoginResponse> {
    try {
      const apiRequest: LoginApiRequest = AuthMapper.toLoginApiRequest(request);
      const response = await apiClient.post<LoginApiResponse>(
        "/auth/login",
        apiRequest
      );

      return AuthMapper.fromLoginApiResponse(response.data);
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: "Login failed. Please try again.",
      };
    }
  }

  async oauthLogin(provider: "google" | "apple"): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<OAuthApiResponse>(
        `/auth/oauth/${provider}`
      );
      return AuthMapper.fromOAuthApiResponse(response.data);
    } catch (error) {
      console.error("OAuth login error:", error);
      return {
        success: false,
        error: `${provider} login failed. Please try again.`,
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }
}

export const authService = new AuthService();
```

**File: `modules/auth/api/mappers/auth.mapper.ts`** - Data transformation layer:

```typescript
import {
  LoginRequest,
  LoginResponse,
} from "@/modules/auth/pods/login/models/login.model";
import {
  LoginApiRequest,
  LoginApiResponse,
  OAuthApiResponse,
} from "../models/auth.api";

export class AuthMapper {
  static toLoginApiRequest(request: LoginRequest): LoginApiRequest {
    return {
      email: request.email,
      password: request.password,
    };
  }

  static fromLoginApiResponse(response: LoginApiResponse): LoginResponse {
    if (response.success && response.data) {
      return {
        success: true,
        user: {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
        },
        token: response.data.token,
      };
    }

    return {
      success: false,
      error: response.error || "Login failed",
    };
  }

  static fromOAuthApiResponse(response: OAuthApiResponse): LoginResponse {
    if (response.success && response.data) {
      return {
        success: true,
        user: {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
        },
        token: response.data.token,
      };
    }

    return {
      success: false,
      error: response.error || "OAuth login failed",
    };
  }
}
```

**File: `modules/auth/api/models/auth.api.ts`** - API request/response models:

```typescript
// API request models
export interface LoginApiRequest {
  email: string;
  password: string;
}

// API response models
export interface LoginApiResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      name?: string;
    };
    token: string;
  };
  error?: string;
}

export interface OAuthApiResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      name?: string;
    };
    token: string;
  };
  error?: string;
}
```

#### Phase 5: Root Page & Layout Updates

**File: `app/page.tsx`** - Redirect to login:

```typescript
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/login");
}
```

**File: `app/layout.tsx`** - Update metadata:

```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AimHarder - CrossFit Class Reservations",
  description: "Automatically book CrossFit classes when they become available",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e40af" },
    { media: "(prefers-color-scheme: dark)", color: "#3b82f6" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

## Mobile-First Responsive Design Strategy

### Breakpoint Strategy:

- **Mobile (default)**: Up to 768px - Single column, stacked form
- **Tablet (md)**: 768px+ - Larger touch targets, improved spacing
- **Desktop (lg)**: 1024px+ - Two-column layout with hero section

### Key Mobile Optimizations:

1. **Touch Targets**: All inputs/buttons minimum 44px height
2. **Viewport Meta**: Prevent zoom on form focus
3. **Large Text**: Readable font sizes for gym environments
4. **High Contrast**: CrossFit theme ensures visibility in bright gym lighting
5. **Simplified Navigation**: Focus on essential actions only

## CrossFit Theme Design Principles

### Color Psychology:

- **Primary Blue**: Trust and professionalism for class booking
- **Orange Accent**: Energy and motivation for workouts
- **Green Success**: Achievement and progress tracking
- **High Contrast**: Visibility in bright gym environments

### Typography:

- **Geist Sans**: Clean, athletic, highly legible
- **Bold Headings**: Strong presence for athlete mindset
- **Clear Hierarchy**: Quick scanning for busy athletes

### Interaction Design:

- **Large Touch Targets**: Easy interaction with gym gloves
- **Immediate Feedback**: Clear success/error states
- **Minimal Steps**: Quick login for time-pressed athletes

## Accessibility Compliance (WCAG 2.1 AA)

### Implementation Requirements:

1. **Color Contrast**: All text meets 4.5:1 ratio minimum
2. **Keyboard Navigation**: Tab order logical and complete
3. **Screen Reader**: Proper ARIA labels and semantic HTML
4. **Focus Management**: Visible focus indicators
5. **Error Handling**: Clear, descriptive error messages

### Specific Implementations:

- `aria-invalid` on form errors
- `htmlFor` associations between labels and inputs
- Semantic button elements with proper roles
- High contrast focus rings
- Descriptive placeholder text

## Performance Considerations

### Next.js Optimizations:

- **Server Components**: Static rendering for better performance
- **Image Optimization**: Automatic WebP conversion for hero images
- **Font Loading**: Preload Geist fonts for faster rendering
- **CSS-in-JS**: Tailwind purges unused styles

### Mobile Performance:

- **Bundle Size**: Only load essential components
- **Lazy Loading**: Defer non-critical resources
- **Prefetch**: Login success navigation routes

## Installation Commands

```bash
# Initialize shadcn/ui
npx shadcn@latest init

# Install required components
npx shadcn@latest add button input label

# Install additional dependencies (if needed)
npm install lucide-react

# Development server
npm run dev
```

## Testing Strategy

### Component Testing:

- Unit tests for login form validation
- Integration tests for authentication flow
- Visual regression tests for responsive design

### Accessibility Testing:

- Screen reader compatibility
- Keyboard navigation flow
- Color contrast validation

### Cross-Device Testing:

- iOS Safari (iPhone/iPad)
- Android Chrome
- Desktop browsers

## Future Enhancements

### Phase 2 Features:

1. **Remember Me**: Secure session persistence
2. **Biometric Auth**: Touch/Face ID integration
3. **Social Recovery**: Account recovery via social logins
4. **Dark Mode Toggle**: Manual theme switching
5. **Progressive Web App**: Offline capability

### Integration Points:

1. **Supabase Auth**: Complete authentication system
2. **Form Validation**: React Hook Form + Zod
3. **State Management**: React Query for auth state
4. **Error Tracking**: Sentry integration
5. **Analytics**: User login flow tracking

## Questions for Clarification

1. **OAuth Providers**: Which OAuth providers are required? (Google, Apple, Facebook?)
2. **Registration Flow**: Should we also implement the sign-up page in this phase?
3. **Password Requirements**: Any specific password complexity requirements?
4. **Session Management**: How long should user sessions last?
5. **Supabase Integration**: Do you have Supabase project details for authentication setup?
6. **Branding Assets**: Do you have specific AimHarder logo/brand assets?
7. **Hero Image**: Do you have a specific CrossFit/gym image for the desktop hero section?

## Implementation Priority

### Critical (Must Have):

- ✅ shadcn/ui initialization
- ✅ CrossFit theme implementation
- ✅ Mobile-responsive login form
- ✅ Basic form validation

### Important (Should Have):

- OAuth provider integration
- Form submission with loading states
- Error handling and display
- Accessibility compliance

### Nice to Have (Could Have):

- Animated transitions
- Progressive Web App features
- Advanced form validation
- Biometric authentication

## Success Metrics

### User Experience:

- Form completion rate > 95%
- Time to login < 10 seconds
- Zero accessibility violations

### Technical Performance:

- Lighthouse Score > 95
- Mobile loading time < 2 seconds
- Cross-browser compatibility 100%

### Business Goals:

- Reduced support requests for login issues
- Increased user engagement
- Successful class reservation completion rate

---

_This implementation plan provides a comprehensive roadmap for creating a professional, accessible, and performant CrossFit login page using shadcn/ui components with mobile-first responsive design._
