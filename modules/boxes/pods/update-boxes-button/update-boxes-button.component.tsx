'use client';

import { Button } from '@/common/ui/button';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface UpdateBoxesButtonProps {
  userEmail: string;
  aimharderToken: string;
  cookies: Array<{ name: string; value: string }>;
  onUpdate?: () => void;
}

export function UpdateBoxesButton({
  userEmail,
  aimharderToken,
  cookies,
  onUpdate,
}: UpdateBoxesButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateBoxes = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/boxes/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail,
          aimharderToken,
          cookies,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update boxes');
      }

      const data = await response.json();

      if (data.newBoxesCount > 0) {
        toast.success(
          `¡Actualizado! Se encontraron ${data.newBoxesCount} box(es) nuevo(s)`
        );
      } else {
        toast.info('No se encontraron nuevos boxes');
      }

      // Trigger refresh callback
      onUpdate?.();
    } catch (error) {
      console.error('Error updating boxes:', error);
      toast.error('Error al actualizar boxes. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleUpdateBoxes}
      disabled={isLoading}
      className="gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Actualizando...' : 'Actualizar boxes'}
    </Button>
  );
}
