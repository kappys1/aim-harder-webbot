"use client";
import { MyPrebookingsComponent } from "./my-prebookings.component";

export function MyPrebookingsContainer() {
  // Get user email from localStorage (client-side only)
  // This will be handled by the client component using useAuth hook
  return <MyPrebookingsComponent userEmail={null} />;
}
