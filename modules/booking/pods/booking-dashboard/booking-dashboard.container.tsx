import React from 'react';
import { cookies } from 'next/headers';
import { CookieService } from '../../../auth/api/services/cookie.service';
import { BookingDashboardComponent } from './booking-dashboard.component';

interface BookingDashboardContainerProps {
  initialDate?: string;
  boxId?: string;
}

export async function BookingDashboardContainer({
  initialDate,
  boxId = '10122', // CrossFit Cerdanyola
}: BookingDashboardContainerProps) {
  // Extract authentication cookies from the request
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const authCookies = CookieService.parseFromRequest(cookieHeader);

  // Validate that we have the required cookies
  const { isValid, missing } = CookieService.validateRequiredCookies(authCookies);

  if (!isValid) {
    console.warn('Missing required authentication cookies:', missing);
  }

  // Set initial date to today if not provided
  const currentDate = initialDate || new Date().toISOString().split('T')[0];

  return (
    <BookingDashboardComponent
      initialDate={currentDate}
      initialBoxId={boxId}
      authCookies={isValid ? authCookies : []}
      isAuthenticated={isValid}
    />
  );
}