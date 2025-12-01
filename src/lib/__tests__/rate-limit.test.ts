import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  clearRateLimit,
  clearAllRateLimits,
  getClientIp,
  getRateLimitHeaders,
} from '../rate-limit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  describe('checkRateLimit', () => {
    it('allows first request', async () => {
      const result = await checkRateLimit('test-ip');

      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
    });

    it('tracks multiple requests', async () => {
      await checkRateLimit('test-ip');
      await checkRateLimit('test-ip');
      const result = await checkRateLimit('test-ip');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('blocks after limit exceeded', async () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        await checkRateLimit('test-ip');
      }

      // 6th request should be blocked
      const result = await checkRateLimit('test-ip');

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('tracks different IPs separately', async () => {
      // Use up limit for IP 1
      for (let i = 0; i < 5; i++) {
        await checkRateLimit('ip-1');
      }

      // IP 2 should still have full quota
      const result = await checkRateLimit('ip-2');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('uses custom configuration', async () => {
      const config = {
        interval: 1000,
        maxRequests: 2,
      };

      await checkRateLimit('test-ip', config);
      await checkRateLimit('test-ip', config);
      const result = await checkRateLimit('test-ip', config);

      expect(result.success).toBe(false);
      expect(result.limit).toBe(2);
    });

    it('includes reset time', async () => {
      const result = await checkRateLimit('test-ip');

      expect(result.reset).toBeGreaterThan(Date.now());
    });
  });

  describe('clearRateLimit', () => {
    it('clears rate limit for specific identifier', async () => {
      // Use up limit
      for (let i = 0; i < 5; i++) {
        await checkRateLimit('test-ip');
      }

      // Clear and verify reset
      clearRateLimit('test-ip');
      const result = await checkRateLimit('test-ip');

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        },
      });

      expect(getClientIp(request)).toBe('1.2.3.4');
    });

    it('extracts IP from x-real-ip', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-real-ip': '1.2.3.4',
        },
      });

      expect(getClientIp(request)).toBe('1.2.3.4');
    });

    it('extracts IP from cf-connecting-ip', () => {
      const request = new Request('http://localhost', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
        },
      });

      expect(getClientIp(request)).toBe('1.2.3.4');
    });

    it('returns unknown when no headers present', () => {
      const request = new Request('http://localhost');

      expect(getClientIp(request)).toBe('unknown');
    });

    it('prioritizes x-forwarded-for over other headers', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.1.1.1',
          'x-real-ip': '2.2.2.2',
          'cf-connecting-ip': '3.3.3.3',
        },
      });

      expect(getClientIp(request)).toBe('1.1.1.1');
    });
  });

  describe('getRateLimitHeaders', () => {
    it('returns formatted headers', () => {
      const result = {
        success: true,
        limit: 5,
        remaining: 3,
        reset: 1234567890,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('5');
      expect(headers['X-RateLimit-Remaining']).toBe('3');
      expect(headers['X-RateLimit-Reset']).toBe('1234567890');
    });
  });
});
