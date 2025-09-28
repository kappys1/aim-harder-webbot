"use client";

import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { UseWeekNavigationReturn } from "../models/week-selector.model";
import { WeekSelectorUtils } from "../utils/week-selector.utils";

export function useWeekNavigation(
  selectedDate: string,
  onDateChange: (date: string) => void
): UseWeekNavigationReturn {
  // Initialize current week start based on selected date
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const initialDate = selectedDate ? parseISO(selectedDate) : new Date();
    return startOfWeek(initialDate, { weekStartsOn: 1 }); // Monday start
  });

  const [isNavigating, setIsNavigating] = useState(false);

  // Calculate current week days (memoized for performance)
  const currentWeek = useMemo(
    () =>
      eachDayOfInterval({
        start: currentWeekStart,
        end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
      }),
    [currentWeekStart]
  );

  // Format week range (memoized for performance)
  const weekRange = useMemo(() => {
    if (currentWeek.length === 0) return "";

    return WeekSelectorUtils.formatWeekRange(
      currentWeek[0],
      currentWeek[6],
      true // Use compact format for same month
    );
  }, [currentWeek]);

  // Navigation functions with debouncing
  const navigateToNextWeek = useCallback(() => {
    if (isNavigating) return;

    // setIsNavigating(true);
    setCurrentWeekStart((prev) => addWeeks(prev, 1));

    // Reset navigation state after animation
    // setTimeout(() => setIsNavigating(false), 150);
  }, [isNavigating]);

  const navigateToPrevWeek = useCallback(() => {
    if (isNavigating) return;

    setIsNavigating(true);
    setCurrentWeekStart((prev) => subWeeks(prev, 1));

    // Reset navigation state after animation
    setTimeout(() => setIsNavigating(false), 150);
  }, [isNavigating]);

  const navigateToWeek = useCallback(
    (date: Date) => {
      if (isNavigating) return;

      setIsNavigating(true);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      setCurrentWeekStart(weekStart);

      // Reset navigation state after animation
      setTimeout(() => setIsNavigating(false), 150);
    },
    [isNavigating]
  );

  const selectDate = useCallback(
    (date: Date) => {
      const formattedDate = WeekSelectorUtils.formatDateForApi(date);
      onDateChange(formattedDate);
    },
    [onDateChange]
  );

  // Update current week when selected date changes externally
  const selectedDateObj = useMemo(() => {
    if (!selectedDate) return new Date();
    try {
      return parseISO(selectedDate);
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  // Auto-navigate to week containing selected date if it's outside current week
  const isSelectedDateInCurrentWeek = useMemo(() => {
    return currentWeek.some(
      (date) => format(date, "yyyy-MM-dd") === selectedDate
    );
  }, [currentWeek, selectedDate]);

  // Navigate to selected date's week if needed
  const navigateToSelectedDate = useCallback(() => {
    if (selectedDate && !isSelectedDateInCurrentWeek && !isNavigating) {
      navigateToWeek(selectedDateObj);
    }
  }, [
    selectedDate,
    isSelectedDateInCurrentWeek,
    isNavigating,
    selectedDateObj,
    navigateToWeek,
  ]);

  // Effect to auto-navigate when selected date changes
  // This ensures the week selector always shows the week containing the selected date
  // useEffect(() => {
  //   navigateToSelectedDate();
  // }, [navigateToSelectedDate]);

  return {
    currentWeek,
    weekRange,
    navigateToNextWeek,
    navigateToPrevWeek,
    navigateToWeek,
    selectDate,
    isNavigating,
  };
}
