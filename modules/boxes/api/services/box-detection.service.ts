import { BOX_CONSTANTS } from '../../constants/box.constants';
import { HtmlParserUtils } from '../../utils/html-parser.utils';
import { BoxUrlUtils } from '../../utils/url.utils';
import type { DetectedBoxInfo } from '../../models/box.model';

export class BoxDetectionService {
  /**
   * Detect all boxes for a user by scraping Aimharder pages
   */
  static async detectUserBoxes(
    aimharderToken: string,
    cookies: Array<{ name: string; value: string }>
  ): Promise<DetectedBoxInfo[]> {
    try {
      // Step 1: Fetch home page to get box links
      const subdomains = await this.fetchBoxSubdomains(aimharderToken, cookies);

      if (subdomains.length === 0) {
        return [];
      }

      // Step 2: For each subdomain, fetch box details
      const detectedBoxes = await Promise.all(
        subdomains.map((subdomain) =>
          this.fetchBoxDetails(subdomain, aimharderToken, cookies)
        )
      );

      // Filter out any failed detections
      return detectedBoxes.filter((box): box is DetectedBoxInfo => box !== null);
    } catch (error) {
      console.error('Error detecting user boxes:', error);
      throw new Error('Failed to detect user boxes');
    }
  }

  /**
   * Fetch box subdomains from home page
   */
  private static async fetchBoxSubdomains(
    aimharderToken: string,
    cookies: Array<{ name: string; value: string }>
  ): Promise<string[]> {
    const homeUrl = `${BOX_CONSTANTS.AIMHARDER.BASE_URL}${BOX_CONSTANTS.AIMHARDER.HOME_PATH}`;

    const response = await fetch(homeUrl, {
      headers: {
        Cookie: this.buildCookieHeader(cookies),
        Authorization: `Bearer ${aimharderToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch home page: ${response.statusText}`);
    }

    const html = await response.text();
    return HtmlParserUtils.extractBoxLinks(html);
  }

  /**
   * Fetch complete box details for a subdomain
   */
  private static async fetchBoxDetails(
    subdomain: string,
    aimharderToken: string,
    cookies: Array<{ name: string; value: string }>
  ): Promise<DetectedBoxInfo | null> {
    try {
      // Fetch box ID from schedule page
      const boxId = await this.fetchBoxId(subdomain, aimharderToken, cookies);

      if (!boxId) {
        console.warn(`Could not extract box ID for subdomain: ${subdomain}`);
        return null;
      }

      // Fetch box details from homepage
      const boxDetails = await this.fetchBoxHomepage(
        subdomain,
        aimharderToken,
        cookies
      );

      return {
        subdomain,
        boxId,
        name: boxDetails.name || subdomain,
        phone: boxDetails.phone,
        email: boxDetails.email,
        address: boxDetails.address,
        website: boxDetails.website,
        logoUrl: boxDetails.logoUrl,
      };
    } catch (error) {
      console.error(`Error fetching box details for ${subdomain}:`, error);
      return null;
    }
  }

  /**
   * Fetch box ID from schedule page
   */
  private static async fetchBoxId(
    subdomain: string,
    aimharderToken: string,
    cookies: Array<{ name: string; value: string }>
  ): Promise<string | null> {
    const scheduleUrl = BoxUrlUtils.buildScheduleUrl(subdomain);

    const response = await fetch(scheduleUrl, {
      headers: {
        Cookie: this.buildCookieHeader(cookies),
        Authorization: `Bearer ${aimharderToken}`,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch schedule page for ${subdomain}`);
      return null;
    }

    const html = await response.text();
    return HtmlParserUtils.extractBoxId(html);
  }

  /**
   * Fetch box details from homepage
   */
  private static async fetchBoxHomepage(
    subdomain: string,
    aimharderToken: string,
    cookies: Array<{ name: string; value: string }>
  ): Promise<{
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    logoUrl?: string;
  }> {
    const homepageUrl = BoxUrlUtils.buildBaseUrl(subdomain);

    const response = await fetch(homepageUrl, {
      headers: {
        Cookie: this.buildCookieHeader(cookies),
        Authorization: `Bearer ${aimharderToken}`,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch homepage for ${subdomain}`);
      return {};
    }

    const html = await response.text();
    return HtmlParserUtils.extractBoxDetails(html, subdomain);
  }

  /**
   * Build cookie header string from cookie array
   */
  private static buildCookieHeader(
    cookies: Array<{ name: string; value: string }>
  ): string {
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  }
}
