import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/admin/debug-env - Debug environment variables (remove after debugging)
export async function GET() {
  return NextResponse.json({
    SITE_URL: process.env.SITE_URL || 'NOT SET',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT SET',
    // Show if .env file values are being read
    hasDbUrl: !!process.env.DATABASE_URL,
  });
}
