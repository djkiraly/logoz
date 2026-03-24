/**
 * SanMar API TypeScript Types
 * Based on SanMar Web Services Integration Guide v24.2
 */

// ===========================================
// Authentication Types
// ===========================================

export interface SanMarCredentials {
  customerNumber: string;
  username: string;
  password: string;
}

export interface PromoStandardsCredentials {
  id: string;       // SanMar.com username
  password: string; // SanMar.com password
}

// ===========================================
// Product Data Types (SanMar Standard)
// ===========================================

export interface SanMarProductBasicInfo {
  uniqueKey: string;
  style: string;
  productTitle: string;
  productDescription: string;
  brandName: string;
  category: string;
  availableSizes: string;
  color: string;
  catalogColor: string;  // Mainframe color for ordering
  size: string;
  sizeIndex: number;
  inventoryKey: string;
  pieceWeight: number;
  caseSize: number;
  productStatus: 'Active' | 'Discontinued' | 'New' | 'Coming Soon' | 'Regular';
  keywords: string;
  priceCode: string;
}

export interface SanMarProductImageInfo {
  productImage: string;
  thumbnailImage: string;
  brandLogoImage: string;
  colorProductImage: string;
  colorProductImageThumbnail: string;
  colorSquareImage: string;
  colorSwatchImage: string;
  specSheet: string;
  frontModel?: string;
  backModel?: string;
  sideModel?: string;
  frontFlat?: string;
  backFlat?: string;
  threeQModel?: string;
  titleImage?: string;
}

export interface SanMarProductPriceInfo {
  piecePrice: number;
  dozenPrice: number;
  casePrice: number;
  pieceSalePrice?: number;
  dozenSalePrice?: number;
  caseSalePrice?: number;
  saleStartDate?: string;
  saleEndDate?: string;
  priceCode: string;
  priceText: string;
}

export interface SanMarProductInfo {
  productBasicInfo: SanMarProductBasicInfo;
  productImageInfo: SanMarProductImageInfo;
  productPriceInfo: SanMarProductPriceInfo;
}

export interface SanMarProductResponse {
  errorOccured: boolean;
  message: string;
  listResponse?: SanMarProductInfo[];
}

// ===========================================
// PromoStandards Product Data V2.0.0
// ===========================================

export interface PromoStandardsColor {
  standardColorName: string;
  approximatePms?: string;
  colorName: string;  // Mainframe/catalog color
}

export interface PromoStandardsApparelSize {
  apparelStyle: string;  // Unisex, Mens, Womens, Youth, MensTall
  labelSize: string;     // XS, S, M, L, XL, etc.
  customSize?: string;   // For pants sizes
}

export interface PromoStandardsDimension {
  dimensionUom: string;
  depth: number;
  height: number;
  width: number;
  weightUom: string;
  weight: number;
}

export interface PromoStandardsShippingPackage {
  packageType: string;
  quantity: number;
  dimensionUom: string;
  depth: number;
  height: number;
  width: number;
  weightUom: string;
  weight: number;
}

export interface PromoStandardsProductPart {
  partId: string;
  primaryColor: PromoStandardsColor;
  colorArray: PromoStandardsColor[];
  apparelSize: PromoStandardsApparelSize;
  dimension: PromoStandardsDimension;
  gtin?: string;
  isRushService: boolean;
  shippingPackageArray: PromoStandardsShippingPackage[];
  endDate?: string;
  effectiveDate: string;
  isCloseout: boolean;
  isCaution: boolean;
  isOnDemand: boolean;
  isHazmat: boolean;
}

export interface PromoStandardsProductCategory {
  category: string;
  subCategory?: string;
}

export interface PromoStandardsProductPrice {
  quantityMin: number;
  quantityMax: number;
  price: number;
}

export interface PromoStandardsProductPriceGroup {
  groupName: string;
  currency: string;
  productPriceArray: PromoStandardsProductPrice[];
}

export interface PromoStandardsFobPoint {
  fobId: string;
  fobCity: string;
  fobState: string;
  fobPostalCode: string;
  fobCountry: string;
}

export interface PromoStandardsProduct {
  productId: string;      // SanMar style number
  productName: string;
  description: string[];
  productKeywordArray?: { keyword: string }[];
  productBrand?: string;
  export: boolean;
  productCategoryArray?: PromoStandardsProductCategory[];
  relatedProductArray?: { relationType: string; productId: string }[];
  primaryImageUrl?: string;
  productPriceGroupArray?: PromoStandardsProductPriceGroup[];
  productPartArray: PromoStandardsProductPart[];
  lastChangeDate: string;
  creationDate: string;
  endDate?: string;
  effectiveDate?: string;
  isCaution: boolean;
  isCloseout: boolean;
  isOnDemand: boolean;
  isHazmat?: boolean;
  fobPointArray: PromoStandardsFobPoint[];
}

// ===========================================
// Media Content Types (PromoStandards V1.1.0)
// ===========================================

export type MediaType = 'Image' | 'Document';

export interface MediaClassType {
  classTypeId: number;
  classTypeName: string;
}

// Class Type IDs
export const MEDIA_CLASS_TYPES = {
  SWATCH: 1004,
  PRIMARY: 1006,
  FRONT: 1007,
  REAR: 1008,
  HIGH: 2001,
  CUSTOM_SIDE: 500,
  CUSTOM_BACK: 502,
  CUSTOM_GROUP: 503,
  CUSTOM_COLOR_SQUARE: 504,
} as const;

export interface MediaContent {
  productId: string;
  partId: string;
  url: string;
  mediaType: MediaType;
  classTypeArray: MediaClassType[];
  color?: string;
  singlePart: boolean;
}

export interface MediaContentResponse {
  mediaContentArray: MediaContent[];
}

// ===========================================
// Inventory Types
// ===========================================

export interface SanMarInventoryItem {
  style: string;
  color: string;
  size: string;
  warehouseQty: number;
  warehouse?: number;
}

export interface SanMarInventoryResponse {
  errorOccured: boolean;
  message: string;
  inventoryList?: SanMarInventoryItem[];
}

// SanMar Warehouse Locations
export const SANMAR_WAREHOUSES = {
  1: { city: 'Seattle', state: 'WA' },
  2: { city: 'Cincinnati', state: 'OH' },
  3: { city: 'Dallas', state: 'TX' },
  4: { city: 'Reno', state: 'NV' },
  5: { city: 'Robbinsville', state: 'NJ' },
  6: { city: 'Jacksonville', state: 'FL' },
  7: { city: 'Minneapolis', state: 'MN' },
  12: { city: 'Phoenix', state: 'AZ' },
  31: { city: 'Richmond', state: 'VA' },
} as const;

// ===========================================
// Bulk/Delta Response (CSV Fields)
// ===========================================

export interface SanMarBulkProductRow {
  UNIQUE_KEY: string;
  PRODUCT_TITLE: string;
  PRODUCT_DESCRIPTION: string;
  'STYLE#': string;
  AVAILABLE_SIZES: string;
  BRAND_LOGO_IMAGE: string;
  THUMBNAIL_IMAGE: string;
  COLOR_SWATCH_IMAGE: string;
  PRODUCT_IMAGE: string;
  SPEC_SHEET: string;
  FRONT_FLAT: string;
  BACK_FLAT: string;
  FRONT_MODEL: string;
  BACK_MODEL: string;
  SIDE_MODEL: string;
  THREE_Q_MODEL: string;
  PRICE_TEXT: string;
  COLOR_NAME: string;
  COLOR_SQUARE_IMAGE: string;
  COLOR_PRODUCT_IMAGE: string;
  COLOR_PRODUCT_IMAGE_THUMBNAIL: string;
  SIZE: string;
  PIECE_WEIGHT: string;
  PIECE_PRICE: string;
  DOZEN_PRICE: string;
  CASE_PRICE: string;
  PIECE_SALE_PRICE: string;
  DOZEN_SALE_PRICE: string;
  CASE_SALE_PRICE: string;
  SALE_START_DATE: string;
  SALE_END_DATE: string;
  CASE_SIZE: string;
  INVENTORY_KEY: string;
  SIZE_INDEX: string;
  CATALOG_COLOR: string;
  PRICE_CODE: string;
  PRODUCT_STATUS: string;
  TITLE_IMAGE: string;
  BRAND_NAME: string;
  KEYWORDS: string;
  CATEGORY: string;
}

// ===========================================
// Error Types
// ===========================================

export interface SanMarError {
  code?: number;
  message: string;
}

// PromoStandards Error Codes
export const PROMOSTANDARDS_ERROR_CODES = {
  100: 'ID (customerID) not found',
  104: 'This account is unauthorized to use this service',
  105: 'Authentication Credentials failed',
  110: 'Authentication Credentials required',
  115: 'wsVersion not found',
  120: 'Required field(s) missing',
  125: 'Not Supported',
  130: 'Product Id not found',
  135: 'Product color not found',
  140: 'Part Id not found',
  145: 'Part color not found',
  150: 'Part size not found',
  155: 'Invalid Date Format',
  160: 'No Results Found',
  200: 'Product Data not found',
  300: 'queryType not found',
  301: 'Reference Number not found',
  302: 'shipmentDateTimeStamp incorrect or invalid date range',
  303: 'Input date should not be older than 7 Days',
  999: 'General Error',
} as const;

// ===========================================
// Sync Configuration Types
// ===========================================

export interface SanMarSyncOptions {
  categories?: string[];      // Filter by SanMar categories
  brands?: string[];          // Filter by brand names
  includeDiscontinued?: boolean;
  defaultVisibility?: boolean;
  defaultCategoryId?: string;
  dryRun?: boolean;           // Don't save changes, just preview
  updateExisting?: boolean;   // Update existing products
  markupPercent?: number;     // Apply markup to prices
}

export interface SyncProgress {
  logId?: string;             // Sync log record ID
  totalItems: number;
  processedItems: number;
  productsAdded: number;
  productsUpdated: number;
  productsSkipped: number;
  variantsAdded: number;
  variantsUpdated: number;
  suppliersAdded: number;
  errors: SanMarError[];
}

// ===========================================
// SanMar Categories & Brands
// ===========================================

export const SANMAR_CATEGORIES = [
  'Activewear',
  'Accessories',
  'Bags',
  'Bottoms',
  'Caps',
  'Infant & Toddler',
  'Juniors & Young Men',
  'Outerwear',
  'Personal Protection',
  'Polos/Knits',
  'Sweatshirts/Fleece',
  'T-Shirts',
  'Tall',
  'Women\'s',
  'Workwear',
  'Woven Shirts',
  'Youth',
] as const;

export type SanMarCategory = typeof SANMAR_CATEGORIES[number];

// Brands with restrictions (require embellishment for resale)
export const RESTRICTED_BRANDS = [
  'Brooks Brothers',
  'New Era',
  'Outdoor Research',
  'The North Face',
  'Carhartt',
  'Nike',
  'Stanley/Stella',
  'Tommy Bahama',
  'Cotopaxi',
  'OGIO',
  'tentree',
  'Travis Mathew',
  'Eddie Bauer',
] as const;

// Brands with MAP pricing restrictions
export const MAP_RESTRICTED_BRANDS = {
  '10_PERCENT': [
    'Alternative Apparel', 'Outdoor Research', 'AllMade', 'Brooks Brothers',
    'Red House', 'Bulwark', 'Champion', 'Red Kap', 'Cotopaxi', 'Russell Outdoors',
    'Eddie Bauer', 'Spacecraft', 'New Era', 'Stanley/Stella', 'Nike', 'tentree',
    'OGIO', 'The North Face', 'Travis Mathew',
  ],
  '20_PERCENT': [
    'Carhartt', 'CornerStone', 'District', 'Mercer+Mettle', 'Port & Co',
    'Port Authority', 'Sport-Tek', 'Volunteer Knitwear', 'Tommy Bahama',
  ],
  'MSRP': ['Nike Bags', 'OGIO Bags'],
  'NO_MAP': [
    'A4', 'Anvil', 'Bella+Canvas', 'Comfort Colors', 'Fruit of the Loom',
    'Gildan', 'Jerzees', 'Next Level', 'Rabbit Skins', 'Wink',
  ],
} as const;

// ===========================================
// API Endpoint Types
// ===========================================

export interface SanMarEndpoints {
  standard: {
    productInfo: string;
    inventory: string;
    pricing: string;
  };
  promostandards: {
    productData: string;
    mediaContent: string;
    inventory: string;
    pricing: string;
  };
}

export const SANMAR_ENDPOINTS: { test: SanMarEndpoints; production: SanMarEndpoints } = {
  test: {
    standard: {
      productInfo: 'https://test-ws.sanmar.com:8080/SanMarWebService/SanMarProductInfoServicePort?wsdl',
      inventory: 'https://test-ws.sanmar.com:8080/SanMarWebService/SanMarWebServicePort?wsdl',
      pricing: 'https://test-ws.sanmar.com:8080/SanMarWebService/SanMarPricingServicePort?wsdl',
    },
    promostandards: {
      productData: 'https://test-ws.sanmar.com:8080/promostandards/ProductDataServiceV2.xml?wsdl',
      mediaContent: 'https://test-ws.sanmar.com:8080/promostandards/MediaContentServiceBinding?wsdl',
      inventory: 'https://test-ws.sanmar.com:8080/promostandards/InventoryServiceBinding?wsdl',
      pricing: 'https://test-ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBinding?wsdl',
    },
  },
  production: {
    standard: {
      productInfo: 'https://ws.sanmar.com:8080/SanMarWebService/SanMarProductInfoServicePort?wsdl',
      inventory: 'https://ws.sanmar.com:8080/SanMarWebService/SanMarWebServicePort?wsdl',
      pricing: 'https://ws.sanmar.com:8080/SanMarWebService/SanMarPricingServicePort?wsdl',
    },
    promostandards: {
      productData: 'https://ws.sanmar.com:8080/promostandards/ProductDataServiceV2.xml?wsdl',
      mediaContent: 'https://ws.sanmar.com:8080/promostandards/MediaContentServiceBinding?wsdl',
      inventory: 'https://ws.sanmar.com:8080/promostandards/InventoryServiceBinding?wsdl',
      pricing: 'https://ws.sanmar.com:8080/promostandards/PricingAndConfigurationServiceBinding?wsdl',
    },
  },
};
