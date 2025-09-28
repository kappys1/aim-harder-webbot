"use client";

import { Button } from "@/common/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, isSameDay, parseISO } from 'date-fns';
import { useCallback, useMemo } from 'react';

import { WeekSelectorProps } from './models/week-selector.model';
import { useWeekNavigation } from './hooks/useWeekNavigation.hook';
import { DayTile } from './day-tile.component';
import { WeekSelectorUtils } from './utils/week-selector.utils';

export function WeekSelector({
  selectedDate,
  onDateChange,
  className,
  disabled = false,
  minDate,
  maxDate
}: WeekSelectorProps) {
  // Parse selected date for comparison
  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return new Date();
    try {
      return parseISO(selectedDate);
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  // Use week navigation hook
  const {
    currentWeek,
    weekRange,
    navigateToNextWeek,
    navigateToPrevWeek,
    selectDate,
    isNavigating
  } = useWeekNavigation(selectedDate, onDateChange);

  // Handle day click
  const handleDayClick = useCallback((date: Date) => {
    if (disabled) return;
    selectDate(date);
  }, [selectDate, disabled]);

  // Check if a date should be disabled
  const isDateDisabled = useCallback((date: Date) => {
    if (disabled) return true;

    return !WeekSelectorUtils.isDateInRange(date, minDate, maxDate);
  }, [disabled, minDate, maxDate]);

  // Get today's date for comparison
  const today = useMemo(() => new Date(), []);

  return (
    <div
      className={cn("week-selector w-full max-w-md", className)}
      role="group"
      aria-label="Selector semanal de fechas"
    >
      {/* Week navigation header */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={navigateToPrevWeek}
          disabled={disabled || isNavigating}
          aria-label="Semana anterior"
          aria-describedby="week-range-display"
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span
          id="week-range-display"
          className="text-sm font-medium text-foreground"
          aria-live="polite"
        >
          {weekRange}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={navigateToNextWeek}
          disabled={disabled || isNavigating}
          aria-label="Semana siguiente"
          aria-describedby="week-range-display"
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day tiles grid */}
      <div
        className="grid grid-cols-7 gap-1"
        role="grid"
        aria-label="Días de la semana"
      >
        {currentWeek.map((date) => (
          <DayTile
            key={date.toISOString()}
            date={date}
            isSelected={isSameDay(date, selectedDateObj)}
            isToday={isSameDay(date, today)}
            isDisabled={isDateDisabled(date)}
            onClick={handleDayClick}
          />
        ))}
      </div>
    </div>
  );
}