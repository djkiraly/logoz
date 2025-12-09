import { describe, it, expect } from 'vitest';
import {
  quoteSchema,
  containsSuspiciousContent,
  sanitizeInput,
  isValidEmailDomain,
} from '../validation';

describe('Quote Validation Schema', () => {
  const validQuote = {
    name: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Corp',
    phone: '+1 (555) 123-4567',
    quantity: 50,
    service: 'SCREEN_PRINT' as const,
    dueDate: '2025-12-31',
    notes: 'Please rush this order',
  };

  describe('valid inputs', () => {
    it('accepts a complete valid quote', () => {
      const result = quoteSchema.safeParse(validQuote);
      expect(result.success).toBe(true);
    });

    it('accepts minimal required fields', () => {
      const minimal = {
        name: 'John Doe',
        email: 'john@example.com',
        quantity: 50,
        service: 'SCREEN_PRINT' as const,
      };

      const result = quoteSchema.safeParse(minimal);
      expect(result.success).toBe(true);
    });

    it('accepts all service types', () => {
      const services = [
        'EMBROIDERY',
        'SCREEN_PRINT',
        'DTG',
        'VINYL',
        'SUBLIMATION',
        'LASER',
        'PROMO',
      ] as const;

      services.forEach((service) => {
        const result = quoteSchema.safeParse({ ...validQuote, service });
        expect(result.success).toBe(true);
      });
    });

    it('trims whitespace from inputs', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        name: '  John Doe  ',
        email: '  JOHN@EXAMPLE.COM  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John Doe');
        expect(result.data.email).toBe('john@example.com');
      }
    });

    it('normalizes email to lowercase', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        email: 'JOHN@EXAMPLE.COM',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('john@example.com');
      }
    });
  });

  describe('name validation', () => {
    it('rejects names shorter than 2 characters', () => {
      const result = quoteSchema.safeParse({ ...validQuote, name: 'A' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.name).toBeDefined();
      }
    });

    it('rejects empty name', () => {
      const result = quoteSchema.safeParse({ ...validQuote, name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects names over 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = quoteSchema.safeParse({ ...validQuote, name: longName });
      expect(result.success).toBe(false);
    });
  });

  describe('email validation', () => {
    it('rejects invalid email format', () => {
      const invalidEmails = [
        'not-an-email',
        'missing@domain',
        '@nodomain.com',
        'spaces in@email.com',
      ];

      invalidEmails.forEach((email) => {
        const result = quoteSchema.safeParse({ ...validQuote, email });
        expect(result.success).toBe(false);
      });
    });

    it('accepts valid email formats', () => {
      const validEmails = [
        'simple@example.com',
        'very.common@example.com',
        'plus+tag@example.com',
        'user@subdomain.example.com',
      ];

      validEmails.forEach((email) => {
        const result = quoteSchema.safeParse({ ...validQuote, email });
        expect(result.success).toBe(true);
      });
    });

    it('rejects emails over 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      const result = quoteSchema.safeParse({ ...validQuote, email: longEmail });
      expect(result.success).toBe(false);
    });
  });

  describe('phone validation', () => {
    it('accepts valid phone formats', () => {
      const validPhones = [
        '+1 (555) 123-4567',
        '555-123-4567',
        '5551234567',
        '+44 20 7946 0958',
      ];

      validPhones.forEach((phone) => {
        const result = quoteSchema.safeParse({ ...validQuote, phone });
        expect(result.success).toBe(true);
      });
    });

    it('rejects phone with letters', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        phone: '555-CALL-ME',
      });
      expect(result.success).toBe(false);
    });

    it('rejects phone too short', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        phone: '123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('quantity validation', () => {
    it('rejects zero quantity', () => {
      const result = quoteSchema.safeParse({ ...validQuote, quantity: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative quantity', () => {
      const result = quoteSchema.safeParse({ ...validQuote, quantity: -5 });
      expect(result.success).toBe(false);
    });

    it('accepts minimum quantity of 1', () => {
      const result = quoteSchema.safeParse({ ...validQuote, quantity: 1 });
      expect(result.success).toBe(true);
    });

    it('rejects quantities over 100,000', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        quantity: 100001,
      });
      expect(result.success).toBe(false);
    });

    it('accepts quantity at limit', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        quantity: 100000,
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-integer quantity', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        quantity: 50.5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('due date validation', () => {
    it('rejects past due dates', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        dueDate: '2020-01-01',
      });
      expect(result.success).toBe(false);
    });

    it('accepts future due dates', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = quoteSchema.safeParse({
        ...validQuote,
        dueDate: dateStr,
      });
      expect(result.success).toBe(true);
    });

    it('accepts today as due date', () => {
      const today = new Date().toISOString().split('T')[0];
      const result = quoteSchema.safeParse({
        ...validQuote,
        dueDate: today,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('notes validation', () => {
    it('rejects notes over 2000 characters', () => {
      const longNotes = 'a'.repeat(2001);
      const result = quoteSchema.safeParse({
        ...validQuote,
        notes: longNotes,
      });
      expect(result.success).toBe(false);
    });

    it('accepts notes at limit', () => {
      const maxNotes = 'a'.repeat(2000);
      const result = quoteSchema.safeParse({
        ...validQuote,
        notes: maxNotes,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('optional fields', () => {
    it('accepts missing company', () => {
      const { company, ...withoutCompany } = validQuote;
      const result = quoteSchema.safeParse(withoutCompany);
      expect(result.success).toBe(true);
    });

    it('accepts missing phone', () => {
      const { phone, ...withoutPhone } = validQuote;
      const result = quoteSchema.safeParse(withoutPhone);
      expect(result.success).toBe(true);
    });

    it('accepts missing dueDate', () => {
      const { dueDate, ...withoutDueDate } = validQuote;
      const result = quoteSchema.safeParse(withoutDueDate);
      expect(result.success).toBe(true);
    });

    it('accepts missing notes', () => {
      const { notes, ...withoutNotes } = validQuote;
      const result = quoteSchema.safeParse(withoutNotes);
      expect(result.success).toBe(true);
    });

    it('transforms empty strings to undefined', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        company: '',
        notes: '',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.company).toBeUndefined();
        expect(result.data.notes).toBeUndefined();
      }
    });
  });

  describe('service validation', () => {
    it('rejects invalid service type', () => {
      const result = quoteSchema.safeParse({
        ...validQuote,
        service: 'INVALID_SERVICE',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('containsSuspiciousContent', () => {
  it('detects script tags', () => {
    expect(containsSuspiciousContent('<script>alert("xss")</script>')).toBe(true);
    expect(containsSuspiciousContent('<SCRIPT>evil()</SCRIPT>')).toBe(true);
  });

  it('detects javascript protocol', () => {
    expect(containsSuspiciousContent('javascript:void(0)')).toBe(true);
    expect(containsSuspiciousContent('JAVASCRIPT:alert(1)')).toBe(true);
  });

  it('detects event handlers', () => {
    expect(containsSuspiciousContent('onclick=malicious()')).toBe(true);
    expect(containsSuspiciousContent('onmouseover = evil()')).toBe(true);
    expect(containsSuspiciousContent('onerror=hack()')).toBe(true);
  });

  it('detects iframe tags', () => {
    expect(containsSuspiciousContent('<iframe src="evil.com">')).toBe(true);
  });

  it('detects data URIs', () => {
    expect(containsSuspiciousContent('data:text/html,<script>alert(1)</script>')).toBe(true);
  });

  it('allows normal text', () => {
    expect(containsSuspiciousContent('Hello, this is a normal message')).toBe(false);
    expect(containsSuspiciousContent('Order 100 t-shirts in blue')).toBe(false);
    expect(containsSuspiciousContent('')).toBe(false);
  });

  it('handles null/undefined gracefully', () => {
    expect(containsSuspiciousContent('')).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('removes angle brackets', () => {
    expect(sanitizeInput('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello world  ')).toBe('hello world');
  });

  it('limits length to 10000 characters', () => {
    const longInput = 'a'.repeat(15000);
    expect(sanitizeInput(longInput).length).toBe(10000);
  });

  it('handles empty input', () => {
    expect(sanitizeInput('')).toBe('');
  });
});

describe('isValidEmailDomain', () => {
  it('validates email with valid domain', () => {
    expect(isValidEmailDomain('user@example.com')).toBe(true);
    expect(isValidEmailDomain('user@subdomain.example.com')).toBe(true);
  });

  it('rejects email without domain', () => {
    expect(isValidEmailDomain('user@')).toBe(false);
    expect(isValidEmailDomain('user')).toBe(false);
  });

  it('rejects email with single-char TLD', () => {
    expect(isValidEmailDomain('user@example.c')).toBe(false);
  });

  it('handles empty input', () => {
    expect(isValidEmailDomain('')).toBe(false);
  });
});
