"use client";

import { Alert, AlertDescription, AlertTitle } from "@/common/ui/alert";
import { Skeleton } from "@/common/ui/skeleton";
import { useAuth } from "@/modules/auth/hooks/useAuth.hook";
import { useBoxes } from "@/modules/boxes/hooks/useBoxes.hook";
import { useBoxFromUrl } from "@/modules/boxes/hooks/useBoxFromUrl.hook";
import { BoxCard } from "@/modules/boxes/pods/box-card/box-card.component";
import { UpdateBoxesButton } from "@/modules/boxes/pods/update-boxes-button/update-boxes-button.component";
import { InfoIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function DashboardClient() {
  const { user } = useAuth();
  const userEmail = user?.email || "";

  const [sessionData, setSessionData] = useState<{
    token: string;
    cookies: Array<{ name: string; value: string }>;
  } | null>(null);
  const [isDetectingBoxes, setIsDetectingBoxes] = useState(false);

  const { boxes, isLoading, error, detectBoxes } = useBoxes(userEmail);
  const { boxId, navigateToBox } = useBoxFromUrl();

  // Get session data and trigger box detection on first access
  useEffect(() => {
    async function fetchSessionDataAndDetectBoxes() {
      if (!userEmail) return;

      try {
        const response = await fetch(`/api/auth/session?email=${userEmail}`);
        if (response.ok) {
          const data = await response.json();
          const session = {
            token: data.aimharderToken || "",
            cookies: data.cookies || [],
          };
          setSessionData(session);

          // Trigger box detection if user has no boxes
          // This runs on first application access, not during login
          if (
            !isLoading &&
            boxes.length === 0 &&
            session.token &&
            session.cookies.length > 0
          ) {
            setIsDetectingBoxes(true);
            detectBoxes({
              userEmail,
              aimharderToken: session.token,
              cookies: session.cookies,
            });
            setIsDetectingBoxes(false);
          }
        }
      } catch (error) {
        console.error("Error fetching session data:", error);
      }
    }

    fetchSessionDataAndDetectBoxes();
  }, [userEmail, boxes.length, isLoading]);

  if (isLoading || isDetectingBoxes) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <Skeleton className="h-10 w-64 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>

            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-40" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>

            {isDetectingBoxes && (
              <div className="mt-6">
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>Detectando boxes</AlertTitle>
                  <AlertDescription>
                    Estamos detectando automáticamente tus boxes. Esto puede
                    tardar unos segundos...
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                No se pudieron cargar tus boxes. Por favor, recarga la página.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Selecciona un box para gestionar tus reservas
            </p>
          </div>

          {/* Boxes Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Mis Boxes</h2>
              {sessionData && (
                <UpdateBoxesButton
                  userEmail={userEmail}
                  aimharderToken={sessionData.token}
                  cookies={sessionData.cookies}
                  onUpdate={() => window.location.reload()}
                />
              )}
            </div>

            {boxes.length === 0 ? (
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>No tienes boxes asignados</AlertTitle>
                <AlertDescription>
                  Haz clic en Actualizar boxes para detectar tus boxes
                  automáticamente.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {boxes.map((box) => (
                  <BoxCard
                    key={box.id}
                    box={box}
                    isActive={boxId === box.id}
                    onClick={() => navigateToBox(box.id, "/booking")}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Info message */}
          {boxes.length > 0 && (
            <div className="mt-8">
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>Selecciona un box</AlertTitle>
                <AlertDescription>
                  Haz clic en cualquier box para ver sus clases y gestionar tus
                  reservas.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
