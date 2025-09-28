"use client";

import { Button } from "@/common/ui/button";
import { cn } from "@/lib/utils";
import { DayTileProps } from './models/week-selector.model';
import { WeekSelectorUtils } from './utils/week-selector.utils';

export function DayTile({
  date,
  isSelected,
  isToday,
  isDisabled,
  onClick,
  className
}: DayTileProps) {
  const dayAbbr = WeekSelectorUtils.getDayAbbreviation(date);
  const dayNumber = date.getDate().toString();
  const fullDateDescription = WeekSelectorUtils.getFullDateDescription(date);

  const handleClick = () => {
    if (!isDisabled) {
      onClick(date);
    }
  };

  return (
    <Button
      variant={isSelected ? "default" : "ghost"}
      size="sm"
      disabled={isDisabled}
      onClick={handleClick}
      className={cn(
        "flex flex-col p-2 h-auto min-h-[60px] transition-all",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isToday && !isSelected && "border border-primary",
        isSelected && "bg-primary text-primary-foreground",
        isDisabled && "opacity-50 cursor-not-allowed",
        className
      )}
      role="gridcell"
      aria-label={fullDateDescription}
      aria-selected={isSelected}
      aria-current={isToday ? "date" : undefined}
      aria-disabled={isDisabled}
    >
      <span className="text-xs font-normal opacity-70">
        {dayAbbr}
      </span>
      <span className="text-lg font-semibold">
        {dayNumber}
      </span>
    </Button>
  );
}