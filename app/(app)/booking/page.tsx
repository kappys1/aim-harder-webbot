import { Metadata } from 'next';
import { BookingDashboardContainer } from '@/modules/booking/pods/booking-dashboard/booking-dashboard.container';

export const metadata: Metadata = {
  title: 'Reservas - AimHarder',
  description: 'Reserva tus clases',
};

interface BookingPageProps {
  searchParams: Promise<{
    date?: string;
    boxId?: string;
  }>;
}

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-gray-50">
      <BookingDashboardContainer
        initialDate={params.date}
        boxId={params.boxId}
      />
    </main>
  );
}