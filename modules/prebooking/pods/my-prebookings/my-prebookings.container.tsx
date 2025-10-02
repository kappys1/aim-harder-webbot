"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MyPrebookingsComponent } from "./my-prebookings.component";

export async function MyPrebookingsContainer() {
  // Get user email from localStorage (client-side only)
  // This will be handled by the client component using useAuth hook
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <MyPrebookingsComponent userEmail={null} />
    </QueryClientProvider>
  );
}
