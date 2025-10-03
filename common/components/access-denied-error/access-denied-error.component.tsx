'use client';

import { Alert, AlertTitle, AlertDescription } from '@/common/ui/alert';
import { Button } from '@/common/ui/button';
import { ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AccessDeniedErrorProps {
  boxName?: string;
  message?: string;
}

export function AccessDeniedError({
  boxName,
  message,
}: AccessDeniedErrorProps) {
  const router = useRouter();

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Alert variant="destructive" className="max-w-lg">
        <ShieldAlert className="h-5 w-5" />
        <AlertTitle className="text-lg font-semibold mb-2">
          Acceso Denegado
        </AlertTitle>
        <AlertDescription className="space-y-4">
          <p>
            {message ||
              `No tienes acceso al box${boxName ? ` "${boxName}"` : ''}.`}
          </p>
          <p className="text-sm">
            Por favor, selecciona uno de tus boxes desde el dashboard.
          </p>
          <Button onClick={handleGoToDashboard} className="mt-4">
            Ir al Dashboard
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
