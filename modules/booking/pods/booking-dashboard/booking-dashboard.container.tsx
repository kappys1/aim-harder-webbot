import { Skeleton } from "@/common/ui/skeleton";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { CookieService } from "../../../auth/api/services/cookie.service";
import { BookingDashboardComponent } from "./booking-dashboard.component";

interface BookingDashboardContainerProps {
  initialDate?: string;
  boxId?: string;
}

function BookingDashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="mb-6">
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="grid gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    </div>
  );
}

export async function BookingDashboardContainer({
  initialDate,
  boxId, // Required - must be passed from parent (obtained from URL)
}: BookingDashboardContainerProps) {
  // Extract authentication cookies from the request
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const authCookies = CookieService.parseFromRequest(cookieHeader);

  // Validate that we have the required cookies
  const { isValid, missing } =
    CookieService.validateRequiredCookies(authCookies);

  if (!isValid) {
    console.warn("Missing required authentication cookies:", missing);
  }

  // Set initial date to today if not provided
  const currentDate = initialDate || new Date().toISOString().split("T")[0];

  // If boxId is not provided, we cannot render the dashboard
  if (!boxId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          No box selected. Please select a box from your dashboard.
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<BookingDashboardLoading />}>
      <BookingDashboardComponent
        initialDate={currentDate}
        initialBoxId={boxId}
        authCookies={isValid ? authCookies : []}
        isAuthenticated={isValid}
      />
    </Suspense>
  );
}
