'use client';

import { Button } from '@/common/ui/button';
import { Calendar, CalendarClock } from 'lucide-react';
import Link from 'next/link';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <CalendarClock className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">
        No tienes pre-reservas activas
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Las pre-reservas te permiten reservar clases automáticamente cuando se abren las reservas.
      </p>
      <Button asChild>
        <Link href="/booking">
          <Calendar className="w-4 h-4 mr-2" />
          Ir al calendario
        </Link>
      </Button>
    </div>
  );
}
