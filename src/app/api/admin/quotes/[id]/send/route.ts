import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';
import { sendEmail } from '@/lib/gmail';
import { trackEntityActivity, trackQuoteFunnelEvent } from '@/lib/analytics';
import { logQuoteSent } from '@/lib/quote-audit';
import crypto from 'crypto';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// Generate a secure random token
function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Format currency
function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

// Format date
function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Generate quote email HTML
function generateQuoteEmailHtml(
  quote: {
    quoteNumber: string;
    title: string | null;
    customerName: string | null;
    customerCompany: string | null;
    notes: string | null;
    validUntil: Date | null;
    requestedDelivery: Date | null;
    subtotal: { toString(): string };
    discount: { toString(): string };
    tax: { toString(): string };
    shipping: { toString(): string };
    total: { toString(): string };
    lineItems: Array<{
      name: string;
      description: string | null;
      quantity: number;
      unitPrice: { toString(): string };
      total: { toString(): string };
    }>;
    customer?: {
      companyName: string | null;
      contactName: string;
    } | null;
  },
  approveUrl: string,
  declineUrl: string,
  siteName: string,
  contactEmail: string,
  contactPhone: string
): string {
  const customerName = quote.customer?.contactName || quote.customerName || 'Valued Customer';
  const companyName = quote.customer?.companyName || quote.customerCompany || '';

  const lineItemsHtml = quote.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #1e293b;">${item.name}</strong>
          ${item.description ? `<br><span style="color: #64748b; font-size: 13px;">${item.description}</span>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569;">${formatCurrency(item.unitPrice.toString())}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #1e293b; font-weight: 500;">${formatCurrency(item.total.toString())}</td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote ${quote.quoteNumber} from ${siteName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); padding: 32px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${siteName}</h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Quote ${quote.quoteNumber}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 24px 40px;">
              <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 20px;">Hello ${customerName},</h2>
              <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">
                Thank you for your interest! Please find your customized quote below${quote.title ? ` for <strong>${quote.title}</strong>` : ''}.
              </p>
              ${companyName ? `<p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px;">Company: ${companyName}</p>` : ''}
            </td>
          </tr>

          <!-- Quote Details Box -->
          <tr>
            <td style="padding: 0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #64748b; font-size: 13px; padding-bottom: 4px;">Quote Number</td>
                        <td style="color: #64748b; font-size: 13px; padding-bottom: 4px; text-align: right;">Valid Until</td>
                      </tr>
                      <tr>
                        <td style="color: #0891b2; font-size: 16px; font-weight: 600;">${quote.quoteNumber}</td>
                        <td style="color: #1e293b; font-size: 16px; font-weight: 500; text-align: right;">${formatDate(quote.validUntil)}</td>
                      </tr>
                      ${quote.requestedDelivery ? `
                      <tr>
                        <td colspan="2" style="padding-top: 12px;">
                          <span style="color: #64748b; font-size: 13px;">Requested Delivery: </span>
                          <span style="color: #1e293b; font-size: 14px; font-weight: 500;">${formatDate(quote.requestedDelivery)}</span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Line Items Table -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Item</th>
                    <th style="padding: 12px; text-align: center; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                    <th style="padding: 12px; text-align: right; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="60%"></td>
                  <td width="40%">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Subtotal</td>
                        <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">${formatCurrency(quote.subtotal.toString())}</td>
                      </tr>
                      ${parseFloat(quote.discount.toString()) > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #16a34a; font-size: 14px;">Discount</td>
                        <td style="padding: 6px 0; color: #16a34a; font-size: 14px; text-align: right;">-${formatCurrency(quote.discount.toString())}</td>
                      </tr>
                      ` : ''}
                      ${parseFloat(quote.tax.toString()) > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Tax</td>
                        <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">${formatCurrency(quote.tax.toString())}</td>
                      </tr>
                      ` : ''}
                      ${parseFloat(quote.shipping.toString()) > 0 ? `
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Shipping</td>
                        <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">${formatCurrency(quote.shipping.toString())}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td colspan="2" style="padding-top: 12px; border-top: 2px solid #e2e8f0;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #1e293b; font-size: 18px; font-weight: 700;">Total</td>
                        <td style="padding: 8px 0; color: #0891b2; font-size: 18px; font-weight: 700; text-align: right;">${formatCurrency(quote.total.toString())}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${quote.notes ? `
          <!-- Notes -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 16px;">
                <p style="margin: 0 0 4px 0; color: #854d0e; font-size: 13px; font-weight: 600;">Notes</p>
                <p style="margin: 0; color: #713f12; font-size: 14px; line-height: 1.5;">${quote.notes}</p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Action Buttons -->
          <tr>
            <td style="padding: 0 40px 40px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px;">Ready to proceed? Let us know your decision:</p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 12px;">
                          <a href="${approveUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.3);">
                            Approve Quote
                          </a>
                        </td>
                        <td style="padding-left: 12px;">
                          <a href="${declineUrl}" style="display: inline-block; padding: 14px 32px; background-color: #f1f5f9; color: #64748b; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px; border: 1px solid #e2e8f0;">
                            Decline Quote
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${siteName}</p>
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                ${contactEmail ? `Email: ${contactEmail}<br>` : ''}
                ${contactPhone ? `Phone: ${contactPhone}` : ''}
              </p>
              <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px;">
                This quote is valid until ${formatDate(quote.validUntil)}. Prices are subject to change after this date.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// POST /api/admin/quotes/[id]/send - Send quote to customer
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await params;

    // Get the quote with all details
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        customer: true,
        lineItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // Get recipient email
    const recipientEmail = quote.customer?.email || quote.customerEmail;
    if (!recipientEmail) {
      return NextResponse.json(
        { error: 'No customer email address available' },
        { status: 400 }
      );
    }

    // Generate access token if not exists
    let accessToken = quote.accessToken;
    if (!accessToken) {
      accessToken = generateAccessToken();
      await prisma.quote.update({
        where: { id },
        data: { accessToken },
      });
    }

    // Get site settings
    const siteSettings = await prisma.siteSetting.findFirst({
      where: { id: 1 },
    });

    const siteName = siteSettings?.siteName || 'Logoz Custom';
    const contactEmail = siteSettings?.contactEmail || '';
    const contactPhone = siteSettings?.contactPhone || '';

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const quoteUrl = `${baseUrl}/quote/${accessToken}`;
    const approveUrl = `${quoteUrl}?action=approve`;
    const declineUrl = `${quoteUrl}?action=decline`;

    // Generate email HTML
    const emailHtml = generateQuoteEmailHtml(
      quote,
      approveUrl,
      declineUrl,
      siteName,
      contactEmail,
      contactPhone
    );

    // Send email
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject: `Quote ${quote.quoteNumber}${quote.title ? `: ${quote.title}` : ''} from ${siteName}`,
      body: emailHtml,
      isHtml: true,
    });

    if (!emailResult.success) {
      adminLogger.error('Failed to send quote email', {
        quoteId: id,
        error: emailResult.error,
      });
      return NextResponse.json(
        { error: emailResult.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    // Update quote status to SENT
    const updatedQuote = await prisma.quote.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        lastModifiedAt: new Date(),
      },
      include: {
        customer: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lineItems: {
          include: {
            product: true,
            supplier: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    adminLogger.info('Quote sent to customer', {
      userId: user.id,
      quoteId: id,
      quoteNumber: quote.quoteNumber,
      recipientEmail,
      messageId: emailResult.messageId,
    });

    // Log audit trail
    await logQuoteSent(
      id,
      quote.quoteNumber,
      recipientEmail,
      { id: user.id, name: user.name, email: user.email }
    );

    // Track activity
    await trackEntityActivity({
      entityType: 'QUOTE',
      entityId: id,
      activityType: 'STATUS_CHANGED',
      userId: user.id,
      oldValue: { status: quote.status },
      newValue: { status: 'SENT', sentTo: recipientEmail },
    });

    // Track funnel event
    await trackQuoteFunnelEvent({
      stage: 'QUOTE_SENT',
      quoteId: id,
      customerId: quote.customerId || undefined,
    });

    return NextResponse.json({
      ok: true,
      data: updatedQuote,
      message: `Quote sent to ${recipientEmail}`,
    });
  } catch (error) {
    adminLogger.error('Failed to send quote', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send quote' },
      { status: 500 }
    );
  }
}
