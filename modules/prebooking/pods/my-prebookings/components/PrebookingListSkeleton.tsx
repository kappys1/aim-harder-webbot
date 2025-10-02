import { Card, CardContent, CardHeader } from "@/common/ui/card";
import { Skeleton } from "@/common/ui/skeleton";

export function PrebookingListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" /> {/* Activity name */}
                <Skeleton className="h-4 w-1/2" /> {/* Date */}
              </div>
              <Skeleton className="h-10 w-10 rounded-md" />{" "}
              {/* Cancel button */}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <Skeleton className="h-4 w-40" /> {/* Location */}
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" /> {/* Badge */}
              <Skeleton className="h-6 w-24" /> {/* Countdown */}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
