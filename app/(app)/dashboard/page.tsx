import { Button } from "@/common/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/common/ui/card";
import { BookingUtils } from "@/modules/booking/utils/booking.utils";
import { Dumbbell, MapPin } from "lucide-react";
import Link from "next/link";

// Box configuration - prepared for multiple boxes
const AVAILABLE_BOXES = [
  {
    id: "1",
    name: "CrossFit Cerdanyola",
    description: "Box principal",
    location: "Cerdanyola del Vallès",
    color: "#3b82f6",
  },
  // Add more boxes here when available
];

export default function DashboardPage() {
  const today = BookingUtils.formatDateForApi(new Date().toISOString());

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Gestiona tus reservas de CrossFit
            </p>
          </div>

          {/* Available Boxes */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Boxes Disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AVAILABLE_BOXES.map((box) => (
                <Card
                  key={box.id}
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: box.color }}
                        />
                        <div>
                          <CardTitle className="text-base">
                            {box.name}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {box.description}
                          </CardDescription>
                        </div>
                      </div>
                      <Dumbbell className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{box.location}</span>
                    </div>
                    <Button asChild className="w-full" size="sm">
                      <Link href={`/booking?boxId=${box.id}`}>Ver Clases</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
