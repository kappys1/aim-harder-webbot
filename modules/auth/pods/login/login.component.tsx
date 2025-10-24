"use client"

import Image from "next/image"
import { LoginForm } from "./components/login-form"

export function LoginComponent() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Form Section - Mobile First */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Brand Header */}
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/" className="flex items-center gap-2 font-bold text-lg">
            <Image
              src="/logo.png"
              alt="AimHarder Logo"
              width={32}
              height={32}
              className="rounded-md"
            />
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
          <h2 className="text-3xl font-bold mb-4">
            Book Your Next WOD
          </h2>
          <p className="text-white/90 text-lg leading-relaxed">
            Automatically reserve your spot in CrossFit classes.
            Never miss a workout again.
          </p>
        </div>
        {/* Optional: Add CrossFit image overlay */}
        <div className="absolute inset-0 bg-black/20" />
      </div>
    </div>
  )
}