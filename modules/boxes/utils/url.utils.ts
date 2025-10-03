export class BoxUrlUtils {
  /**
   * Build base URL for a box subdomain
   */
  static buildBaseUrl(subdomain: string): string {
    return `https://${subdomain}.aimharder.com`;
  }

  /**
   * Build schedule URL for a box
   */
  static buildScheduleUrl(subdomain: string): string {
    return `${this.buildBaseUrl(subdomain)}/schedule?cl`;
  }

  /**
   * Build URL with boxId query parameter
   */
  static buildUrlWithBoxId(path: string, boxId: string): string {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('boxId', boxId);
    return url.toString();
  }

  /**
   * Extract boxId from URL search params
   */
  static extractBoxIdFromUrl(searchParams: URLSearchParams): string | null {
    return searchParams.get('boxId');
  }

  /**
   * Navigate to path with boxId
   */
  static navigateWithBoxId(router: any, path: string, boxId: string): void {
    const url = new URL(path, window.location.origin);
    url.searchParams.set('boxId', boxId);
    router.push(url.pathname + url.search);
  }
}
