'use client';

import { Card, CardContent } from '@/common/ui/card';
import { Badge } from '@/common/ui/badge';
import { MapPin, Phone, Mail, Globe, Check } from 'lucide-react';
import type { BoxWithAccess } from '../../models/box.model';
import { cn } from '@/common/lib/utils';

interface BoxCardProps {
  box: BoxWithAccess;
  isActive?: boolean;
  onClick?: () => void;
}

export function BoxCard({ box, isActive, onClick }: BoxCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]',
        isActive && 'ring-2 ring-primary shadow-md'
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        {/* Header with logo and active indicator */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {box.logoUrl ? (
              <img
                src={box.logoUrl}
                alt={box.name}
                className="w-12 h-12 rounded-md object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">
                  {box.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-lg">{box.name}</h3>
              <p className="text-sm text-muted-foreground">{box.subdomain}</p>
            </div>
          </div>

          {isActive && (
            <Badge variant="default" className="gap-1">
              <Check className="w-3 h-3" />
              Active
            </Badge>
          )}
        </div>

        {/* Box details */}
        <div className="space-y-2 text-sm">
          {box.address && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{box.address}</span>
            </div>
          )}

          {box.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span>{box.phone}</span>
            </div>
          )}

          {box.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{box.email}</span>
            </div>
          )}

          {box.website && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="w-4 h-4 flex-shrink-0" />
              <a
                href={box.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate"
                onClick={(e) => e.stopPropagation()}
              >
                {box.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        {/* Last accessed indicator */}
        {box.lastAccessedAt && (
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
            Last accessed: {new Date(box.lastAccessedAt).toLocaleDateString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
