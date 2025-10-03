import { z } from 'zod'

// Zod schemas for validation
export const LoginRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fingerprint: z.string().optional() // Browser fingerprint for session identification
})

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().optional()
  }).optional(),
  token: z.string().optional(),
  error: z.string().optional(),
  aimharderToken: z.string().optional(),
  cookies: z.array(z.object({
    name: z.string(),
    value: z.string()
  })).optional()
})

// TypeScript types derived from schemas
export type LoginRequest = z.infer<typeof LoginRequestSchema>
export type LoginResponse = z.infer<typeof LoginResponseSchema>

// Form state type
export interface LoginFormState {
  isSubmitting: boolean
  error: string | null
  fieldErrors: {
    email?: string
    password?: string
  }
}