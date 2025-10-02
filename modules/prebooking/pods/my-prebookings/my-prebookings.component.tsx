'use client';

import { useMyPrebookings } from './hooks/useMyPrebookings.hook';
import { PrebookingCard } from './components/PrebookingCard.component';
import { EmptyState } from './components/EmptyState.component';
import { PrebookingListSkeleton } from './components/PrebookingListSkeleton';
import { Badge } from '@/common/ui/badge';
import { Button } from '@/common/ui/button';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth.hook';
import { useEffect } from 'react';

interface MyPrebookingsProps {
  userEmail: string | null;
}

export function MyPrebookingsComponent({ userEmail: _userEmail }: MyPrebookingsProps) {
  const { user } = useAuth();
  const userEmail = user?.email || null;

  const {
    prebookings,
    isLoading,
    error,
    refetch,
    cancelPrebooking,
    isCanceling,
  } = useMyPrebookings(userEmail);

  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Mis Pre-reservas</h1>
        </div>
        <PrebookingListSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Mis Pre-reservas</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className="text-destructive mb-4">
            Error al cargar pre-reservas
          </p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mis Pre-reservas</h1>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="tabular-nums">
            {prebookings.length}
          </Badge>
          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            aria-label="Actualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* List */}
      {prebookings.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {prebookings.map((prebooking) => (
            <PrebookingCard
              key={prebooking.id}
              prebooking={prebooking}
              onCancel={cancelPrebooking}
              isCanceling={isCanceling}
            />
          ))}
        </div>
      )}
    </div>
  );
}
