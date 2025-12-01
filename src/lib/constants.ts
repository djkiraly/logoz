export const FULFILLMENT_METHODS = [
  'EMBROIDERY',
  'SCREEN_PRINT',
  'DTG',
  'VINYL',
  'SUBLIMATION',
  'LASER',
  'PROMO',
] as const;

export type FulfillmentMethodValue = (typeof FULFILLMENT_METHODS)[number];




