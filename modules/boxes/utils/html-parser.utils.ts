import * as cheerio from 'cheerio';
import { BOX_CONSTANTS } from '../constants/box.constants';

export class HtmlParserUtils {
  /**
   * Extract box ID from schedule page HTML
   * Pattern: box: 10122
   */
  static extractBoxId(html: string): string | null {
    const match = html.match(BOX_CONSTANTS.PATTERNS.BOX_ID);
    return match ? match[1] : null;
  }

  /**
   * Extract subdomain from URL
   * Example: https://crossfitcerdanyola300.aimharder.com → crossfitcerdanyola300
   */
  static extractSubdomain(url: string): string | null {
    const match = url.match(BOX_CONSTANTS.PATTERNS.SUBDOMAIN);
    return match ? match[1] : null;
  }

  /**
   * Extract all box links from home page HTML
   * Returns array of subdomains
   */
  static extractBoxLinks(html: string): string[] {
    const subdomains: string[] = [];
    const matches = html.matchAll(BOX_CONSTANTS.PATTERNS.BOX_LINK);

    for (const match of matches) {
      if (match[1] && match[1] !== 'www') {
        subdomains.push(match[1]);
      }
    }

    return [...new Set(subdomains)]; // Remove duplicates
  }

  /**
   * Extract box details from homepage HTML
   */
  static extractBoxDetails(html: string, subdomain: string): {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    website?: string;
    logoUrl?: string;
  } {
    const $ = cheerio.load(html);

    // Extract box name
    let name: string | undefined;
    for (const selector of BOX_CONSTANTS.SELECTORS.BOX_NAME.split(', ')) {
      const text = $(selector).first().text().trim();
      if (text) {
        name = text;
        break;
      }
    }

    // Extract phone
    const phoneLink = $(BOX_CONSTANTS.SELECTORS.PHONE).first();
    const phone = phoneLink.attr('href')?.replace('tel:', '').trim();

    // Extract email
    const emailLink = $(BOX_CONSTANTS.SELECTORS.EMAIL).first();
    const email = emailLink.attr('href')?.replace('mailto:', '').trim();

    // Extract address
    let address: string | undefined;
    for (const selector of BOX_CONSTANTS.SELECTORS.ADDRESS.split(', ')) {
      const text = $(selector).first().text().trim();
      if (text) {
        address = text;
        break;
      }
    }

    // Extract website
    const websiteLink = $(BOX_CONSTANTS.SELECTORS.WEBSITE).first();
    const website = websiteLink.attr('href');

    // Extract logo
    const logoImg = $(BOX_CONSTANTS.SELECTORS.LOGO).first();
    let logoUrl = logoImg.attr('src');

    // Convert relative URL to absolute
    if (logoUrl && !logoUrl.startsWith('http')) {
      logoUrl = `https://${subdomain}.aimharder.com${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
    }

    return {
      name,
      phone,
      email,
      address,
      website,
      logoUrl,
    };
  }
}
