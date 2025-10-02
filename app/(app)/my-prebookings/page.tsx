import { Metadata } from 'next';
import { MyPrebookingsContainer } from '@/modules/prebooking/pods/my-prebookings/my-prebookings.container';

export const metadata: Metadata = {
  title: 'Mis Pre-reservas - AimHarder',
  description: 'Gestiona tus pre-reservas de clases',
};

export const dynamic = 'force-dynamic';

export default function MyPrebookingsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <MyPrebookingsContainer />
    </main>
  );
}
