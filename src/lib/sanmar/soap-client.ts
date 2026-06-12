/**
 * SanMar SOAP Client
 * Handles communication with SanMar Web Services APIs
 */

import { adminLogger } from '../logger';
import {
  SanMarCredentials,
  PromoStandardsCredentials,
  SanMarProductResponse,
  SanMarInventoryResponse,
  PromoStandardsProduct,
  PromoStandardsProductPart,
  PromoStandardsColor,
  PromoStandardsApparelSize,
  PromoStandardsDimension,
  MediaContentResponse,
  SANMAR_ENDPOINTS,
  SanMarError,
} from './types';

// XML namespaces
const NAMESPACES = {
  soap: 'http://schemas.xmlsoap.org/soap/envelope/',
  sanmarImpl: 'http://impl.webservice.integration.sanmar.com/',
  psProduct: 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/',
  psProductShared: 'http://www.promostandards.org/WSDL/ProductDataService/2.0.0/SharedObjects/',
  psMedia: 'http://www.promostandards.org/WSDL/MediaService/1.0.0/',
  psMediaShared: 'http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/',
};

type Environment = 'test' | 'production';

/**
 * Build SOAP envelope wrapper
 */
function buildSoapEnvelope(body: string, additionalNamespaces: Record<string, string> = {}): string {
  const nsAttrs = Object.entries(additionalNamespaces)
    .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
    .join(' ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NAMESPACES.soap}" ${nsAttrs}>
  <soapenv:Header/>
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;
}

const SOAP_TIMEOUT_MS = 30_000; // abort a hung request after 30s
const SOAP_MAX_RETRIES = 3; // total attempts on transient failures

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Execute a SOAP request with a hard timeout and bounded exponential-backoff
 * retries for transient network/5xx failures. Non-retryable errors (e.g. 4xx
 * other than 408/429) fail fast.
 */
async function executeSoapRequest(
  endpoint: string,
  soapAction: string,
  body: string
): Promise<string> {
  const url = endpoint.replace('?wsdl', '');
  let lastError: unknown;

  for (let attempt = 1; attempt <= SOAP_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SOAP_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': soapAction,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < SOAP_MAX_RETRIES) {
          lastError = new Error(`SOAP request failed: ${response.status} ${response.statusText}`);
          await sleep(2 ** attempt * 250); // 500ms, 1s, ...
          continue;
        }
        throw new Error(`SOAP request failed: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      const isAbort = error instanceof Error && error.name === 'AbortError';
      // Retry on timeouts and network errors; otherwise surface immediately.
      if (attempt < SOAP_MAX_RETRIES && (isAbort || error instanceof TypeError)) {
        await sleep(2 ** attempt * 250);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('SOAP request failed after retries');
}

/**
 * Simple XML parser for extracting values
 * Note: For production, consider using a proper XML parser library
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  // Handle namespaced tags (e.g., ns2:productId)
  const patterns = [
    new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i'),
    new RegExp(`<[^:]+:${tagName}>([^<]*)</[^:]+:${tagName}>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      return decodeXmlEntities(match[1]);
    }
  }
  return null;
}

/**
 * Extract all values for a tag (for arrays)
 */
function extractAllXmlValues(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const patterns = [
    new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'gi'),
    new RegExp(`<[^:]+:${tagName}>([^<]*)</[^:]+:${tagName}>`, 'gi'),
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(xml)) !== null) {
      results.push(decodeXmlEntities(match[1]));
    }
  }
  return results;
}

/**
 * Extract XML block (for nested elements)
 */
function extractXmlBlock(xml: string, tagName: string): string | null {
  const patterns = [
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'),
    new RegExp(`<[^:]+:${tagName}[^>]*>([\\s\\S]*?)</[^:]+:${tagName}>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Extract all XML blocks for a tag
 */
function extractAllXmlBlocks(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const patterns = [
    new RegExp(`<${tagName}[^>]*>[\\s\\S]*?</${tagName}>`, 'gi'),
    new RegExp(`<[^:]+:${tagName}[^>]*>[\\s\\S]*?</[^:]+:${tagName}>`, 'gi'),
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(xml)) !== null) {
      results.push(match[0]);
    }
  }
  return results;
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Encode a value for safe interpolation into a SOAP/XML request body.
 * Prevents credentials or parameters that contain XML metacharacters
 * (&, <, >, ", ') from breaking the envelope or injecting markup.
 */
function encodeXmlEntities(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Check for SOAP fault or error response
 */
function checkForError(xml: string, context?: string): SanMarError | null {
  // Check for SOAP fault
  const faultString = extractXmlValue(xml, 'faultstring');
  if (faultString) {
    adminLogger.warn('SanMar SOAP fault detected', {
      context,
      errorType: 'soap_fault',
      message: faultString,
    });
    return { message: faultString };
  }

  // Check for errorOccured flag
  const errorOccured = extractXmlValue(xml, 'errorOccured');
  if (errorOccured === 'true') {
    const message = extractXmlValue(xml, 'message') || 'Unknown error';
    adminLogger.warn('SanMar API error detected', {
      context,
      errorType: 'api_error',
      message,
    });
    return { message };
  }

  // Check for PromoStandards error
  const errorCode = extractXmlValue(xml, 'Code');
  if (errorCode) {
    const errorMessage = extractXmlValue(xml, 'Description') || 'Unknown error';
    adminLogger.warn('PromoStandards error detected', {
      context,
      errorType: 'promostandards_error',
      code: errorCode,
      message: errorMessage,
    });
    return { code: parseInt(errorCode, 10), message: errorMessage };
  }

  return null;
}

// ===========================================
// SanMar Standard API Client
// ===========================================

export class SanMarStandardClient {
  private credentials: SanMarCredentials;
  private environment: Environment;

  constructor(credentials: SanMarCredentials, environment: Environment = 'production') {
    this.credentials = credentials;
    this.environment = environment;
  }

  private get endpoints() {
    return SANMAR_ENDPOINTS[this.environment].standard;
  }

  /**
   * Build SanMar Standard auth XML block
   */
  private buildAuthBlock(): string {
    return `
      <sanMarCustomerNumber>${encodeXmlEntities(this.credentials.customerNumber)}</sanMarCustomerNumber>
      <sanMarUserName>${encodeXmlEntities(this.credentials.username)}</sanMarUserName>
      <sanMarUserPassword>${encodeXmlEntities(this.credentials.password)}</sanMarUserPassword>
    `;
  }

  /**
   * Get product info by style, optionally with color and size
   */
  async getProductInfoByStyleColorSize(
    style: string,
    color?: string,
    size?: string
  ): Promise<SanMarProductResponse> {
    const body = buildSoapEnvelope(
      `<impl:getProductInfoByStyleColorSize xmlns:impl="${NAMESPACES.sanmarImpl}">
        <arg0>
          <style>${encodeXmlEntities(style)}</style>
          ${color ? `<color>${encodeXmlEntities(color)}</color>` : ''}
          ${size ? `<size>${encodeXmlEntities(size)}</size>` : ''}
        </arg0>
        <arg1>
          ${this.buildAuthBlock()}
        </arg1>
      </impl:getProductInfoByStyleColorSize>`,
      { impl: NAMESPACES.sanmarImpl }
    );

    try {
      const response = await executeSoapRequest(
        this.endpoints.productInfo,
        'getProductInfoByStyleColorSize',
        body
      );

      const error = checkForError(response, 'getProductInfoByStyleColorSize');
      if (error) {
        return { errorOccured: true, message: error.message };
      }

      // Parse response - simplified for now
      // In production, use a proper XML parser
      return {
        errorOccured: false,
        message: extractXmlValue(response, 'message') || 'Success',
        listResponse: this.parseProductInfoResponse(response),
      };
    } catch (err) {
      adminLogger.error('SanMar API error: getProductInfoByStyleColorSize', {
        style,
        error: err instanceof Error ? err.message : String(err),
      });
      return { errorOccured: true, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get product info by brand
   */
  async getProductInfoByBrand(brandName: string): Promise<SanMarProductResponse> {
    const body = buildSoapEnvelope(
      `<impl:getProductInfoByBrand xmlns:impl="${NAMESPACES.sanmarImpl}">
        <arg0>
          <brandName>${encodeXmlEntities(brandName)}</brandName>
        </arg0>
        <arg1>
          ${this.buildAuthBlock()}
        </arg1>
      </impl:getProductInfoByBrand>`,
      { impl: NAMESPACES.sanmarImpl }
    );

    try {
      const response = await executeSoapRequest(
        this.endpoints.productInfo,
        'getProductInfoByBrand',
        body
      );

      const error = checkForError(response, 'getProductInfoByBrand');
      if (error) {
        return { errorOccured: true, message: error.message };
      }

      return {
        errorOccured: false,
        message: extractXmlValue(response, 'message') || 'Success',
        listResponse: this.parseProductInfoResponse(response),
      };
    } catch (err) {
      adminLogger.error('SanMar API error: getProductInfoByBrand', {
        brandName,
        error: err instanceof Error ? err.message : String(err),
      });
      return { errorOccured: true, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get product info by category
   */
  async getProductInfoByCategory(category: string): Promise<SanMarProductResponse> {
    const body = buildSoapEnvelope(
      `<impl:getProductInfoByCategory xmlns:impl="${NAMESPACES.sanmarImpl}">
        <arg0>
          <category>${encodeXmlEntities(category)}</category>
        </arg0>
        <arg1>
          ${this.buildAuthBlock()}
        </arg1>
      </impl:getProductInfoByCategory>`,
      { impl: NAMESPACES.sanmarImpl }
    );

    try {
      const response = await executeSoapRequest(
        this.endpoints.productInfo,
        'getProductInfoByCategory',
        body
      );

      const error = checkForError(response, 'getProductInfoByCategory');
      if (error) {
        return { errorOccured: true, message: error.message };
      }

      return {
        errorOccured: false,
        message: extractXmlValue(response, 'message') || 'Success',
        listResponse: this.parseProductInfoResponse(response),
      };
    } catch (err) {
      adminLogger.error('SanMar API error: getProductInfoByCategory', {
        category,
        error: err instanceof Error ? err.message : String(err),
      });
      return { errorOccured: true, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Trigger bulk product info export to FTP
   */
  async getProductBulkInfo(): Promise<{ success: boolean; message: string }> {
    const body = buildSoapEnvelope(
      `<impl:getProductBulkInfo xmlns:impl="${NAMESPACES.sanmarImpl}">
        <arg0>
          ${this.buildAuthBlock()}
        </arg0>
      </impl:getProductBulkInfo>`,
      { impl: NAMESPACES.sanmarImpl }
    );

    try {
      const response = await executeSoapRequest(
        this.endpoints.productInfo,
        'getProductBulkInfo',
        body
      );

      const error = checkForError(response, 'getProductBulkInfo');
      if (error) {
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: extractXmlValue(response, 'message') || 'Bulk export initiated',
      };
    } catch (err) {
      adminLogger.error('SanMar API error: getProductBulkInfo', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Trigger delta product info export to FTP
   */
  async getProductDeltaInfo(): Promise<{ success: boolean; message: string }> {
    const body = buildSoapEnvelope(
      `<impl:getProductDeltaInfo xmlns:impl="${NAMESPACES.sanmarImpl}">
        <arg0>
          ${this.buildAuthBlock()}
        </arg0>
      </impl:getProductDeltaInfo>`,
      { impl: NAMESPACES.sanmarImpl }
    );

    try {
      const response = await executeSoapRequest(
        this.endpoints.productInfo,
        'getProductDeltaInfo',
        body
      );

      const error = checkForError(response, 'getProductDeltaInfo');
      if (error) {
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: extractXmlValue(response, 'message') || 'Delta export initiated',
      };
    } catch (err) {
      adminLogger.error('SanMar API error: getProductDeltaInfo', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get inventory by style/color/size
   */
  async getInventory(
    style: string,
    color?: string,
    size?: string
  ): Promise<SanMarInventoryResponse> {
    const body = buildSoapEnvelope(
      `<impl:getInventoryQtyForStyleColorSize xmlns:impl="${NAMESPACES.sanmarImpl}">
        <arg0>
          <style>${encodeXmlEntities(style)}</style>
          ${color ? `<color>${encodeXmlEntities(color)}</color>` : ''}
          ${size ? `<size>${encodeXmlEntities(size)}</size>` : ''}
        </arg0>
        <arg1>
          ${this.buildAuthBlock()}
        </arg1>
      </impl:getInventoryQtyForStyleColorSize>`,
      { impl: NAMESPACES.sanmarImpl }
    );

    try {
      const response = await executeSoapRequest(
        this.endpoints.inventory,
        'getInventoryQtyForStyleColorSize',
        body
      );

      const error = checkForError(response, 'getInventory');
      if (error) {
        return { errorOccured: true, message: error.message };
      }

      return {
        errorOccured: false,
        message: 'Success',
        inventoryList: this.parseInventoryResponse(response),
      };
    } catch (err) {
      adminLogger.error('SanMar API error: getInventory', {
        style,
        error: err instanceof Error ? err.message : String(err),
      });
      return { errorOccured: true, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Parse product info XML response
   */
  private parseProductInfoResponse(xml: string): SanMarProductResponse['listResponse'] {
    const listBlocks = extractAllXmlBlocks(xml, 'listResponse');
    if (!listBlocks.length) return [];

    return listBlocks.map((block) => ({
      productBasicInfo: {
        uniqueKey: extractXmlValue(block, 'uniqueKey') || '',
        style: extractXmlValue(block, 'style') || '',
        productTitle: extractXmlValue(block, 'productTitle') || '',
        productDescription: extractXmlValue(block, 'productDescription') || '',
        brandName: extractXmlValue(block, 'brandName') || '',
        category: extractXmlValue(block, 'category') || '',
        availableSizes: extractXmlValue(block, 'availableSizes') || '',
        color: extractXmlValue(block, 'color') || '',
        catalogColor: extractXmlValue(block, 'catalogColor') || '',
        size: extractXmlValue(block, 'size') || '',
        sizeIndex: parseInt(extractXmlValue(block, 'sizeIndex') || '0', 10),
        inventoryKey: extractXmlValue(block, 'inventoryKey') || '',
        pieceWeight: parseFloat(extractXmlValue(block, 'pieceWeight') || '0'),
        caseSize: parseInt(extractXmlValue(block, 'caseSize') || '0', 10),
        productStatus: (extractXmlValue(block, 'productStatus') || 'Active') as 'Active' | 'Discontinued' | 'New' | 'Coming Soon' | 'Regular',
        keywords: extractXmlValue(block, 'keywords') || '',
        priceCode: extractXmlValue(block, 'priceCode') || '',
      },
      productImageInfo: {
        productImage: extractXmlValue(block, 'productImage') || '',
        thumbnailImage: extractXmlValue(block, 'thumbnailImage') || '',
        brandLogoImage: extractXmlValue(block, 'brandLogoImage') || '',
        colorProductImage: extractXmlValue(block, 'colorProductImage') || '',
        colorProductImageThumbnail: extractXmlValue(block, 'colorProductImageThumbnail') || '',
        colorSquareImage: extractXmlValue(block, 'colorSquareImage') || '',
        colorSwatchImage: extractXmlValue(block, 'colorSwatchImage') || '',
        specSheet: extractXmlValue(block, 'specSheet') || '',
        frontModel: extractXmlValue(block, 'frontModel') || undefined,
        backModel: extractXmlValue(block, 'backModel') || undefined,
        sideModel: extractXmlValue(block, 'sideModel') || undefined,
        frontFlat: extractXmlValue(block, 'frontFlat') || undefined,
        backFlat: extractXmlValue(block, 'backFlat') || undefined,
        threeQModel: extractXmlValue(block, 'threeQModel') || undefined,
      },
      productPriceInfo: {
        piecePrice: parseFloat(extractXmlValue(block, 'piecePrice') || '0'),
        dozenPrice: parseFloat(extractXmlValue(block, 'dozenPrice') || '0'),
        casePrice: parseFloat(extractXmlValue(block, 'casePrice') || '0'),
        pieceSalePrice: parseFloat(extractXmlValue(block, 'pieceSalePrice') || '0') || undefined,
        dozenSalePrice: parseFloat(extractXmlValue(block, 'dozenSalePrice') || '0') || undefined,
        caseSalePrice: parseFloat(extractXmlValue(block, 'caseSalePrice') || '0') || undefined,
        saleStartDate: extractXmlValue(block, 'saleStartDate') || undefined,
        saleEndDate: extractXmlValue(block, 'saleEndDate') || undefined,
        priceCode: extractXmlValue(block, 'priceCode') || '',
        priceText: extractXmlValue(block, 'priceText') || '',
      },
    }));
  }

  /**
   * Parse inventory XML response
   */
  private parseInventoryResponse(xml: string): SanMarInventoryResponse['inventoryList'] {
    const inventoryBlocks = extractAllXmlBlocks(xml, 'inventoryList') ||
                           extractAllXmlBlocks(xml, 'return');
    if (!inventoryBlocks.length) return [];

    return inventoryBlocks.map((block) => ({
      style: extractXmlValue(block, 'style') || '',
      color: extractXmlValue(block, 'color') || '',
      size: extractXmlValue(block, 'size') || '',
      warehouseQty: parseInt(extractXmlValue(block, 'warehouseQty') || '0', 10),
      warehouse: parseInt(extractXmlValue(block, 'warehouse') || '0', 10) || undefined,
    }));
  }
}

// ===========================================
// PromoStandards API Client
// ===========================================

export class PromoStandardsClient {
  private credentials: PromoStandardsCredentials;
  private environment: Environment;

  constructor(credentials: PromoStandardsCredentials, environment: Environment = 'production') {
    this.credentials = credentials;
    this.environment = environment;
  }

  private get endpoints() {
    return SANMAR_ENDPOINTS[this.environment].promostandards;
  }

  /**
   * Get product data by productId (style number)
   */
  async getProduct(
    productId: string,
    options?: {
      partId?: string;
      colorName?: string;
      apparelStyle?: string;
      labelSize?: string;
    }
  ): Promise<{ success: boolean; product?: PromoStandardsProduct; error?: string }> {
    const body = buildSoapEnvelope(
      `<ns:GetProductRequest xmlns:ns="${NAMESPACES.psProduct}" xmlns:shar="${NAMESPACES.psProductShared}">
        <shar:wsVersion>2.0.0</shar:wsVersion>
        <shar:id>${encodeXmlEntities(this.credentials.id)}</shar:id>
        <shar:password>${encodeXmlEntities(this.credentials.password)}</shar:password>
        <shar:localizationCountry>us</shar:localizationCountry>
        <shar:localizationLanguage>en</shar:localizationLanguage>
        <shar:productId>${encodeXmlEntities(productId)}</shar:productId>
        ${options?.partId ? `<shar:partId>${encodeXmlEntities(options.partId)}</shar:partId>` : ''}
        ${options?.colorName ? `<shar:colorName>${encodeXmlEntities(options.colorName)}</shar:colorName>` : ''}
        ${options?.apparelStyle || options?.labelSize ? `
        <shar:ApparelSizeArray>
          <shar:ApparelSize>
            ${options.apparelStyle ? `<shar:apparelStyle>${encodeXmlEntities(options.apparelStyle)}</shar:apparelStyle>` : ''}
            ${options.labelSize ? `<shar:labelSize>${encodeXmlEntities(options.labelSize)}</shar:labelSize>` : ''}
          </shar:ApparelSize>
        </shar:ApparelSizeArray>
        ` : ''}
      </ns:GetProductRequest>`,
      { ns: NAMESPACES.psProduct, shar: NAMESPACES.psProductShared }
    );

    try {
      const response = await executeSoapRequest(
        this.endpoints.productData,
        'getProduct',
        body
      );

      const error = checkForError(response, 'PromoStandards:getProduct');
      if (error) {
        return { success: false, error: error.message };
      }

      // Parse product from response
      const product = this.parseProductResponse(response);
      if (!product) {
        return { success: false, error: 'No product data found' };
      }

      return { success: true, product };
    } catch (err) {
      adminLogger.error('PromoStandards API error: getProduct', {
        productId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get sellable products
   */
  async getProductSellable(
    productId?: string
  ): Promise<{ success: boolean; products?: { productId: string; partId: string }[]; error?: string }> {
    const body = buildSoapEnvelope(
      `<ns:GetProductSellableRequest xmlns:ns="${NAMESPACES.psProduct}" xmlns:shar="${NAMESPACES.psProductShared}">
        <shar:wsVersion>2.0.0</shar:wsVersion>
        <shar:id>${encodeXmlEntities(this.credentials.id)}</shar:id>
        <shar:password>${encodeXmlEntities(this.credentials.password)}</shar:password>
        ${productId ? `<shar:productId>${encodeXmlEntities(productId)}</shar:productId>` : ''}
        <shar:isSellable>true</shar:isSellable>
      </ns:GetProductSellableRequest>`,
      { ns: NAMESPACES.psProduct, shar: NAMESPACES.psProductShared }
    );

    try {
      const response = await executeSoapRequest(
        this.endpoints.productData,
        'getProductSellable',
        body
      );

      const error = checkForError(response, 'PromoStandards:getProductSellable');
      if (error) {
        return { success: false, error: error.message };
      }

      const productBlocks = extractAllXmlBlocks(response, 'ProductSellable');
      const products = productBlocks.map((block) => ({
        productId: extractXmlValue(block, 'productId') || '',
        partId: extractXmlValue(block, 'partId') || '',
      }));

      return { success: true, products };
    } catch (err) {
      adminLogger.error('PromoStandards API error: getProductSellable', {
        productId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Get media content (images) for a product
   */
  async getMediaContent(
    productId: string,
    mediaType: 'Image' | 'Document' = 'Image',
    partId?: string,
    classType?: number
  ): Promise<{ success: boolean; media?: MediaContentResponse; error?: string }> {
    const body = buildSoapEnvelope(
      `<ns:GetMediaContentRequest xmlns:ns="${NAMESPACES.psMedia}" xmlns:shar="${NAMESPACES.psMediaShared}">
        <shar:wsVersion>1.1.0</shar:wsVersion>
        <shar:id>${encodeXmlEntities(this.credentials.id)}</shar:id>
        <shar:password>${encodeXmlEntities(this.credentials.password)}</shar:password>
        <shar:cultureName>en-us</shar:cultureName>
        <shar:mediaType>${encodeXmlEntities(mediaType)}</shar:mediaType>
        <shar:productId>${encodeXmlEntities(productId)}</shar:productId>
        ${partId ? `<shar:partId>${encodeXmlEntities(partId)}</shar:partId>` : ''}
        ${classType ? `<ns:classType>${encodeXmlEntities(classType)}</ns:classType>` : ''}
      </ns:GetMediaContentRequest>`,
      { ns: NAMESPACES.psMedia, shar: NAMESPACES.psMediaShared }
    );

    try {
      const response = await executeSoapRequest(
        this.endpoints.mediaContent,
        'getMediaContent',
        body
      );

      const error = checkForError(response, 'PromoStandards:getMediaContent');
      if (error) {
        return { success: false, error: error.message };
      }

      const media = this.parseMediaContentResponse(response);
      return { success: true, media };
    } catch (err) {
      adminLogger.error('PromoStandards API error: getMediaContent', {
        productId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Parse GetProduct response
   */
  private parseProductResponse(xml: string): PromoStandardsProduct | null {
    const productBlock = extractXmlBlock(xml, 'Product');
    if (!productBlock) return null;

    // Parse descriptions
    const descriptions = extractAllXmlValues(productBlock, 'description');

    // Parse keywords
    const keywordBlocks = extractAllXmlBlocks(productBlock, 'ProductKeyword');
    const keywords = keywordBlocks.map((block) => ({
      keyword: extractXmlValue(block, 'keyword') || '',
    }));

    // Parse categories
    const categoryBlocks = extractAllXmlBlocks(productBlock, 'ProductCategory');
    const categories = categoryBlocks.map((block) => ({
      category: extractXmlValue(block, 'category') || '',
      subCategory: extractXmlValue(block, 'subCategory') || undefined,
    }));

    // Parse product parts (simplified)
    const partBlocks = extractAllXmlBlocks(productBlock, 'ProductPart');
    const parts = partBlocks.map((block) => this.parseProductPart(block));

    // Parse FOB points
    const fobBlocks = extractAllXmlBlocks(productBlock, 'FobPoint');
    const fobPoints = fobBlocks.map((block) => ({
      fobId: extractXmlValue(block, 'fobId') || '',
      fobCity: extractXmlValue(block, 'fobCity') || '',
      fobState: extractXmlValue(block, 'fobState') || '',
      fobPostalCode: extractXmlValue(block, 'fobPostalCode') || '',
      fobCountry: extractXmlValue(block, 'fobCountry') || '',
    }));

    return {
      productId: extractXmlValue(productBlock, 'productId') || '',
      productName: extractXmlValue(productBlock, 'productName') || '',
      description: descriptions,
      productKeywordArray: keywords.length > 0 ? keywords : undefined,
      productBrand: extractXmlValue(productBlock, 'productBrand') || undefined,
      export: extractXmlValue(productBlock, 'export') === 'true',
      productCategoryArray: categories.length > 0 ? categories : undefined,
      primaryImageUrl: extractXmlValue(productBlock, 'primaryImageUrl') || undefined,
      productPartArray: parts,
      lastChangeDate: extractXmlValue(productBlock, 'lastChangeDate') || '',
      creationDate: extractXmlValue(productBlock, 'creationDate') || '',
      endDate: extractXmlValue(productBlock, 'endDate') || undefined,
      effectiveDate: extractXmlValue(productBlock, 'effectiveDate') || undefined,
      isCaution: extractXmlValue(productBlock, 'isCaution') === 'true',
      isCloseout: extractXmlValue(productBlock, 'isCloseout') === 'true',
      isOnDemand: extractXmlValue(productBlock, 'isOnDemand') === 'true',
      isHazmat: extractXmlValue(productBlock, 'isHazmat') === 'true',
      fobPointArray: fobPoints,
    };
  }

  /**
   * Parse product part from XML
   */
  private parseProductPart(xml: string): PromoStandardsProductPart {
    const colorBlock = extractXmlBlock(xml, 'Color') || '';
    const primaryColor: PromoStandardsColor = {
      standardColorName: extractXmlValue(colorBlock, 'standardColorName') || '',
      approximatePms: extractXmlValue(colorBlock, 'approximatePms') || undefined,
      colorName: extractXmlValue(colorBlock, 'colorName') || '',
    };

    const apparelSizeBlock = extractXmlBlock(xml, 'ApparelSize') || '';
    const apparelSize: PromoStandardsApparelSize = {
      apparelStyle: extractXmlValue(apparelSizeBlock, 'apparelStyle') || '',
      labelSize: extractXmlValue(apparelSizeBlock, 'labelSize') || '',
      customSize: extractXmlValue(apparelSizeBlock, 'customSize') || undefined,
    };

    const dimensionBlock = extractXmlBlock(xml, 'Dimension') || '';
    const dimension: PromoStandardsDimension = {
      dimensionUom: extractXmlValue(dimensionBlock, 'dimensionUom') || 'IN',
      depth: parseFloat(extractXmlValue(dimensionBlock, 'depth') || '0'),
      height: parseFloat(extractXmlValue(dimensionBlock, 'height') || '0'),
      width: parseFloat(extractXmlValue(dimensionBlock, 'width') || '0'),
      weightUom: extractXmlValue(dimensionBlock, 'weightUom') || 'OZ',
      weight: parseFloat(extractXmlValue(dimensionBlock, 'weight') || '0'),
    };

    return {
      partId: extractXmlValue(xml, 'partId') || '',
      primaryColor,
      colorArray: [primaryColor],
      apparelSize,
      dimension,
      gtin: extractXmlValue(xml, 'gtin') || undefined,
      isRushService: extractXmlValue(xml, 'isRushService') === 'true',
      shippingPackageArray: [],
      endDate: extractXmlValue(xml, 'endDate') || undefined,
      effectiveDate: extractXmlValue(xml, 'effectiveDate') || '',
      isCloseout: extractXmlValue(xml, 'isCloseout') === 'true',
      isCaution: extractXmlValue(xml, 'isCaution') === 'true',
      isOnDemand: extractXmlValue(xml, 'isOnDemand') === 'true',
      isHazmat: extractXmlValue(xml, 'isHazmat') === 'true',
    };
  }

  /**
   * Parse media content response
   */
  private parseMediaContentResponse(xml: string): MediaContentResponse {
    const mediaBlocks = extractAllXmlBlocks(xml, 'MediaContent');

    const mediaContentArray = mediaBlocks.map((block) => {
      const classTypeBlocks = extractAllXmlBlocks(block, 'ClassType');
      const classTypeArray = classTypeBlocks.map((ctBlock) => ({
        classTypeId: parseInt(extractXmlValue(ctBlock, 'classTypeId') || '0', 10),
        classTypeName: extractXmlValue(ctBlock, 'classTypeName') || '',
      }));

      return {
        productId: extractXmlValue(block, 'productId') || '',
        partId: extractXmlValue(block, 'partId') || '',
        url: extractXmlValue(block, 'url') || '',
        mediaType: (extractXmlValue(block, 'mediaType') || 'Image') as 'Image' | 'Document',
        classTypeArray,
        color: extractXmlValue(block, 'color') || undefined,
        singlePart: extractXmlValue(block, 'singlePart') === 'true',
      };
    });

    return { mediaContentArray };
  }
}

// ===========================================
// Factory function for creating clients
// ===========================================

export function createSanMarClient(
  credentials: SanMarCredentials,
  environment: Environment = 'production'
): { standard: SanMarStandardClient; promostandards: PromoStandardsClient } {
  return {
    standard: new SanMarStandardClient(credentials, environment),
    promostandards: new PromoStandardsClient(
      { id: credentials.username, password: credentials.password },
      environment
    ),
  };
}

/**
 * Test SanMar API connection
 */
export async function testSanMarConnection(
  credentials: SanMarCredentials,
  environment: Environment = 'production'
): Promise<{ success: boolean; error?: string }> {
  const client = new SanMarStandardClient(credentials, environment);

  adminLogger.info('SanMar connection test initiated', {
    environment,
    customerNumber: credentials.customerNumber,
    username: credentials.username,
  });

  try {
    // Test with a known style number
    const result = await client.getProductInfoByStyleColorSize('PC61');

    if (result.errorOccured) {
      adminLogger.error('SanMar connection test failed - API error', {
        environment,
        customerNumber: credentials.customerNumber,
        username: credentials.username,
        error: result.message,
      });
      return { success: false, error: result.message };
    }

    adminLogger.info('SanMar connection test successful', {
      environment,
      customerNumber: credentials.customerNumber,
    });
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Connection test failed';
    adminLogger.error('SanMar connection test failed - network error', {
      environment,
      customerNumber: credentials.customerNumber,
      error: errorMessage,
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}
