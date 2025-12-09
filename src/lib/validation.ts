import { z } from 'zod';
import { FULFILLMENT_METHODS } from '@/lib/constants';

// Custom error messages for better UX
const errors = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number',
  minLength: (field: string, min: number) =>
    `${field} must be at least ${min} characters`,
  maxLength: (field: string, max: number) =>
    `${field} must be less than ${max} characters`,
};

/**
 * Quote request validation schema with sanitization
 * Note: Zod 4 uses different API for custom error messages
 */
export const quoteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, errors.minLength('Name', 2))
    .max(100, errors.maxLength('Name', 100)),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email(errors.email)
    .max(255, errors.maxLength('Email', 255)),

  company: z
    .string()
    .trim()
    .max(200, errors.maxLength('Company', 200))
    .optional()
    .transform((val) => val || undefined),

  phone: z
    .string()
    .trim()
    .max(20, errors.maxLength('Phone', 20))
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        // Allow common phone formats: +1 (555) 123-4567, 555-123-4567, etc.
        return /^[+\d\s()-]{10,20}$/.test(val);
      },
      { message: errors.phone }
    )
    .transform((val) => val || undefined),

  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(100000, 'For quantities over 100,000, please contact us directly'),

  service: z.enum(FULFILLMENT_METHODS, {
    error: 'Please select a valid service',
  }),

  dueDate: z
    .string()
    .optional()
    .refine(
      (date) => {
        if (!date) return true;
        // Parse both dates as date-only strings (YYYY-MM-DD) for comparison
        const selectedDateStr = date.split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        return selectedDateStr >= todayStr;
      },
      { message: 'Due date cannot be in the past' }
    )
    .transform((val) => val || undefined),

  notes: z
    .string()
    .trim()
    .max(2000, errors.maxLength('Notes', 2000))
    .optional()
    .transform((val) => val || undefined),

  productSku: z
    .string()
    .trim()
    .max(50, errors.maxLength('Product SKU', 50))
    .optional()
    .transform((val) => val || undefined),
});

export type QuotePayload = z.infer<typeof quoteSchema>;

/**
 * Check for potentially malicious content in user input
 * Used as an additional security layer
 */
export function containsSuspiciousContent(text: string): boolean {
  if (!text) return false;

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers like onclick=
    /<iframe/i,
    /data:text\/html/i,
    /<object/i,
    /<embed/i,
    /expression\s*\(/i, // CSS expression
    /url\s*\(\s*["']?\s*data:/i, // CSS data URIs
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(text));
}

/**
 * Sanitize user input by removing potentially dangerous characters
 * Apply this to untrusted text before storing/displaying
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .slice(0, 10000); // Hard limit on any input
}

/**
 * Validate that an email domain exists (basic check)
 * This is a quick validation - for production, consider DNS validation
 */
export function isValidEmailDomain(email: string): boolean {
  if (!email) return false;

  const domain = email.split('@')[1];
  if (!domain) return false;

  // Check for valid TLD
  const parts = domain.split('.');
  if (parts.length < 2) return false;

  const tld = parts[parts.length - 1];
  // TLD should be at least 2 characters
  return tld.length >= 2;
}
