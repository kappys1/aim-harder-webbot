import { Button } from "@/common/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-foreground mb-4">
          Welcome to AimHarder Dashboard
        </h1>
        <p className="text-muted-foreground text-lg mb-8">
          Your CrossFit class reservations will be managed here.
        </p>

        {/* Active Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold">
                Booking System
              </CardTitle>
              <Calendar className="w-5 h-5 ml-auto text-blue-600" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                View and manage your CrossFit class reservations for CrossFit
                Cerdanyola.
              </p>
              <Button asChild className="w-full">
                <Link href="/booking">View Available Classes</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
