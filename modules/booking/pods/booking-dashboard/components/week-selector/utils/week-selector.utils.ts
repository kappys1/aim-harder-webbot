import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

export class WeekSelectorUtils {
  /**
   * Formats a week range in Spanish locale
   * @param weekStart - Start date of the week
   * @param weekEnd - End date of the week
   * @param compactSameMonth - Show compact format for same month (optional)
   * @returns Formatted week range string (e.g., "13 Ene - 19 Ene")
   */
  static formatWeekRange(
    weekStart: Date,
    weekEnd: Date,
    compactSameMonth = false
  ): string {
    if (compactSameMonth && weekStart.getMonth() === weekEnd.getMonth()) {
      const startDay = format(weekStart, 'd');
      const endDateWithMonth = format(weekEnd, 'd MMM', { locale: es });
      return `${startDay} - ${endDateWithMonth}`;
    }

    const startFormatted = format(weekStart, 'd MMM', { locale: es });
    const endFormatted = format(weekEnd, 'd MMM', { locale: es });
    return `${startFormatted} - ${endFormatted}`;
  }

  /**
   * Checks if a date is within the specified range
   * @param date - Date to check
   * @param minDate - Minimum date string (YYYY-MM-DD)
   * @param maxDate - Maximum date string (YYYY-MM-DD)
   * @returns True if date is within range
   */
  static isDateInRange(
    date: Date,
    minDate?: string,
    maxDate?: string
  ): boolean {
    if (minDate) {
      const min = parseISO(minDate);
      if (isBefore(date, min)) return false;
    }

    if (maxDate) {
      const max = parseISO(maxDate);
      if (isAfter(date, max)) return false;
    }

    return true;
  }

  /**
   * Gets Spanish day abbreviation for a date
   * @param date - Date to get abbreviation for
   * @returns Day abbreviation (e.g., "lun", "mar", "mié")
   */
  static getDayAbbreviation(date: Date): string {
    return format(date, 'E', { locale: es });
  }

  /**
   * Gets full Spanish date description for accessibility
   * @param date - Date to get description for
   * @returns Full date description (e.g., "miércoles, 15 de enero de 2025")
   */
  static getFullDateDescription(date: Date): string {
    return format(date, 'EEEE, dd \'de\' MMMM \'de\' yyyy', { locale: es });
  }

  /**
   * Formats date to API format (YYYY-MM-DD)
   * @param date - Date to format
   * @returns Date string in YYYY-MM-DD format
   */
  static formatDateForApi(date: Date): string {
    return format(date, 'yyyy-MM-dd');
  }
}