export interface WeekSelectorProps {
  /** Currently selected date in YYYY-MM-DD format */
  selectedDate: string;
  /** Callback when date changes - Compatible with existing handleDateChange */
  onDateChange: (date: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Disable the entire component */
  disabled?: boolean;
  /** Minimum selectable date in YYYY-MM-DD format */
  minDate?: string;
  /** Maximum selectable date in YYYY-MM-DD format */
  maxDate?: string;
}

export interface DayTileProps {
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  isDisabled: boolean;
  onClick: (date: Date) => void;
  className?: string;
}

export interface UseWeekNavigationReturn {
  currentWeek: Date[];
  weekRange: string;
  navigateToNextWeek: () => void;
  navigateToPrevWeek: () => void;
  navigateToWeek: (date: Date) => void;
  selectDate: (date: Date) => void;
  isNavigating: boolean;
}