'use client';

import { PreBooking, PreBookingStatus } from '@/modules/prebooking/models/prebooking.model';
import { useCountdown } from '../hooks/useCountdown.hook';
import { Clock, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface PreBookingBadgeProps {
  prebooking: PreBooking;
  compact?: boolean;
}

const statusConfig: Record<PreBookingStatus, {
  label: string;
  icon: React.ComponentType<any>;
  className: string;
  showCountdown: boolean;
}> = {
  pending: {
    label: 'Prereserva activa',
    icon: Clock,
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    showCountdown: true,
  },
  loaded: {
    label: 'Preparando...',
    icon: Loader2,
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    showCountdown: true,
  },
  executing: {
    label: 'Ejecutando',
    icon: Loader2,
    className: 'bg-purple-100 text-purple-700 border-purple-200',
    showCountdown: false,
  },
  completed: {
    label: 'Reservado ✓',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 border-green-200',
    showCountdown: false,
  },
  failed: {
    label: 'Error',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 border-red-200',
    showCountdown: false,
  },
};

export function PreBookingBadge({ prebooking, compact = false }: PreBookingBadgeProps) {
  const countdown = useCountdown(prebooking.availableAt);
  const config = statusConfig[prebooking.status];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${config.className}`}>
        <Icon className={`w-3 h-3 ${prebooking.status === 'executing' || prebooking.status === 'loaded' ? 'animate-spin' : ''}`} />
        <span>{config.label}</span>
        {config.showCountdown && !countdown.isExpired && (
          <span className="font-mono">{countdown.formatted}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border ${config.className}`}>
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${prebooking.status === 'executing' || prebooking.status === 'loaded' ? 'animate-spin' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{config.label}</div>
        {config.showCountdown && (
          <div className="text-xs mt-1 space-y-0.5">
            {countdown.isExpired ? (
              <div className="text-amber-600">Ejecutando pronto...</div>
            ) : (
              <>
                <div>Se reservará en: <span className="font-mono font-semibold">{countdown.formatted}</span></div>
                <div className="text-xs opacity-75">
                  {new Intl.DateTimeFormat('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'UTC'  // CRITICAL: Force UTC to avoid timezone-dependent display
                  }).format(prebooking.availableAt)}
                </div>
              </>
            )}
          </div>
        )}
        {prebooking.status === 'completed' && prebooking.result && (
          <div className="text-xs mt-1">
            Reservado exitosamente
          </div>
        )}
        {prebooking.status === 'failed' && (
          <div className="text-xs mt-1 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{prebooking.errorMessage || prebooking.result?.message || 'Error al reservar'}</span>
          </div>
        )}
      </div>
    </div>
  );
}