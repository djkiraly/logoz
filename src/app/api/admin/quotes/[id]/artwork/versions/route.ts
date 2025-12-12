import { NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { handleApiError, ApiException } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET - Get all artwork versions for a quote
export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new ApiException('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (!isDatabaseEnabled) {
      throw new ApiException('Database not configured', 503, 'SERVICE_UNAVAILABLE');
    }

    const { id } = await context.params;

    // First verify the quote exists
    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        quoteNumber: true,
        artworkVersion: true,
        artworkUrl: true,
        artworkFileName: true,
        artworkSentAt: true,
        artworkApprovedAt: true,
        artworkDeclinedAt: true,
        artworkNotes: true,
      },
    });

    if (!quote) {
      throw new ApiException('Quote not found', 404, 'NOT_FOUND');
    }

    // Fetch all archived versions
    const archivedVersions = await prisma.artworkVersion.findMany({
      where: { quoteId: id },
      orderBy: { version: 'desc' },
    });

    // Build the current version if artwork exists
    let currentVersion = null;
    if (quote.artworkUrl && quote.artworkFileName) {
      let currentStatus = 'PENDING';
      if (quote.artworkApprovedAt) {
        currentStatus = 'APPROVED';
      } else if (quote.artworkDeclinedAt) {
        currentStatus = 'DECLINED';
      } else if (quote.artworkSentAt) {
        currentStatus = 'SENT';
      }

      currentVersion = {
        id: 'current',
        version: quote.artworkVersion,
        url: quote.artworkUrl,
        fileName: quote.artworkFileName,
        status: currentStatus,
        sentAt: quote.artworkSentAt,
        approvedAt: quote.artworkApprovedAt,
        declinedAt: quote.artworkDeclinedAt,
        customerNotes: quote.artworkNotes,
        isCurrent: true,
      };
    }

    // Combine current and archived versions
    const allVersions = currentVersion
      ? [currentVersion, ...archivedVersions.map((v) => ({ ...v, isCurrent: false }))]
      : archivedVersions.map((v) => ({ ...v, isCurrent: false }));

    return NextResponse.json({
      ok: true,
      data: {
        versions: allVersions,
        totalVersions: allVersions.length,
        currentVersion: quote.artworkVersion,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
