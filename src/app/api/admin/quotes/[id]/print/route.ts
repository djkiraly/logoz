import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { adminLogger } from '@/lib/logger';

type RouteParams = {
  params: Promise<{ id: string }>;
};

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

// Generate printable quote HTML
function generatePrintableQuoteHtml(
  quote: {
    quoteNumber: string;
    title: string | null;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerCompany: string | null;
    notes: string | null;
    validUntil: Date | null;
    requestedDelivery: Date | null;
    subtotal: { toString(): string };
    discount: { toString(): string };
    tax: { toString(): string };
    shipping: { toString(): string };
    total: { toString(): string };
    createdAt: Date;
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
      email: string;
      phone: string | null;
    } | null;
  },
  siteName: string,
  contactEmail: string,
  contactPhone: string,
  address: string
): string {
  const customerName = quote.customer?.contactName || quote.customerName || 'N/A';
  const companyName = quote.customer?.companyName || quote.customerCompany || '';
  const customerEmail = quote.customer?.email || quote.customerEmail || '';
  const customerPhone = quote.customer?.phone || quote.customerPhone || '';

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
  <title>Quote ${quote.quoteNumber} - ${siteName}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    @page { margin: 0.5in; size: letter; }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">

  <!-- Print Button -->
  <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 1000;">
    <button onclick="window.print()" style="padding: 12px 24px; background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(8, 145, 178, 0.3);">
      Print Quote
    </button>
    <button onclick="window.close()" style="margin-left: 8px; padding: 12px 24px; background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">
      Close
    </button>
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); padding: 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${siteName}</h1>
                    <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                      ${address ? `${address}<br>` : ''}
                      ${contactPhone ? `${contactPhone} • ` : ''}${contactEmail}
                    </p>
                  </td>
                  <td style="text-align: right;">
                    <div style="background: rgba(255,255,255,0.2); border-radius: 8px; padding: 16px 24px; display: inline-block;">
                      <p style="margin: 0; color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Quote</p>
                      <p style="margin: 4px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 700;">${quote.quoteNumber}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Quote Info & Customer -->
          <tr>
            <td style="padding: 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="vertical-align: top;">
                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Bill To</p>
                    <p style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 600;">${customerName}</p>
                    ${companyName ? `<p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;">${companyName}</p>` : ''}
                    ${customerEmail ? `<p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;">${customerEmail}</p>` : ''}
                    ${customerPhone ? `<p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;">${customerPhone}</p>` : ''}
                  </td>
                  <td width="50%" style="vertical-align: top; text-align: right;">
                    <table cellpadding="0" cellspacing="0" style="margin-left: auto;">
                      <tr>
                        <td style="padding: 4px 16px 4px 0; color: #64748b; font-size: 13px;">Date:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-size: 13px; font-weight: 500;">${formatDate(quote.createdAt)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 16px 4px 0; color: #64748b; font-size: 13px;">Valid Until:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-size: 13px; font-weight: 500;">${formatDate(quote.validUntil)}</td>
                      </tr>
                      ${quote.requestedDelivery ? `
                      <tr>
                        <td style="padding: 4px 16px 4px 0; color: #64748b; font-size: 13px;">Delivery:</td>
                        <td style="padding: 4px 0; color: #1e293b; font-size: 13px; font-weight: 500;">${formatDate(quote.requestedDelivery)}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${quote.title ? `
          <!-- Quote Title -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <div style="background-color: #f0f9ff; border-left: 4px solid #0891b2; padding: 12px 16px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #0e7490; font-size: 15px; font-weight: 600;">${quote.title}</p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Line Items Table -->
          <tr>
            <td style="padding: 0 40px 24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">Item</th>
                    <th style="padding: 12px; text-align: center; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 80px;">Qty</th>
                    <th style="padding: 12px; text-align: right; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 100px;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 100px;">Total</th>
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
                  <td width="55%"></td>
                  <td width="45%">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; padding: 16px;">
                      <tr>
                        <td style="padding: 6px 16px; color: #64748b; font-size: 14px;">Subtotal</td>
                        <td style="padding: 6px 16px; color: #1e293b; font-size: 14px; text-align: right;">${formatCurrency(quote.subtotal.toString())}</td>
                      </tr>
                      ${parseFloat(quote.discount.toString()) > 0 ? `
                      <tr>
                        <td style="padding: 6px 16px; color: #16a34a; font-size: 14px;">Discount</td>
                        <td style="padding: 6px 16px; color: #16a34a; font-size: 14px; text-align: right;">-${formatCurrency(quote.discount.toString())}</td>
                      </tr>
                      ` : ''}
                      ${parseFloat(quote.tax.toString()) > 0 ? `
                      <tr>
                        <td style="padding: 6px 16px; color: #64748b; font-size: 14px;">Tax</td>
                        <td style="padding: 6px 16px; color: #1e293b; font-size: 14px; text-align: right;">${formatCurrency(quote.tax.toString())}</td>
                      </tr>
                      ` : ''}
                      ${parseFloat(quote.shipping.toString()) > 0 ? `
                      <tr>
                        <td style="padding: 6px 16px; color: #64748b; font-size: 14px;">Shipping</td>
                        <td style="padding: 6px 16px; color: #1e293b; font-size: 14px; text-align: right;">${formatCurrency(quote.shipping.toString())}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td colspan="2" style="padding: 8px 16px 0 16px;"><div style="border-top: 2px solid #e2e8f0;"></div></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; color: #1e293b; font-size: 18px; font-weight: 700;">Total</td>
                        <td style="padding: 12px 16px; color: #0891b2; font-size: 18px; font-weight: 700; text-align: right;">${formatCurrency(quote.total.toString())}</td>
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
                <p style="margin: 0 0 8px 0; color: #854d0e; font-size: 13px; font-weight: 600;">Notes</p>
                <p style="margin: 0; color: #713f12; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${quote.notes}</p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; color: #1e293b; font-size: 14px; font-weight: 600;">Thank you for your business!</p>
                    <p style="margin: 0; color: #64748b; font-size: 12px;">
                      This quote is valid until ${formatDate(quote.validUntil)}. Prices are subject to change after this date.
                    </p>
                  </td>
                  <td style="text-align: right;">
                    <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                      Generated on ${formatDate(new Date())}
                    </p>
                  </td>
                </tr>
              </table>
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

// GET /api/admin/quotes/[id]/print - Get printable quote HTML
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!isDatabaseEnabled) {
      return new NextResponse('Database not configured', { status: 500 });
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
      return new NextResponse('Quote not found', { status: 404 });
    }

    // Get site settings
    const siteSettings = await prisma.siteSetting.findFirst({
      where: { id: 1 },
    });

    const siteName = siteSettings?.siteName || 'Logoz Custom';
    const contactEmail = siteSettings?.contactEmail || '';
    const contactPhone = siteSettings?.contactPhone || '';
    const address = siteSettings?.address || '';

    // Generate printable HTML
    const html = generatePrintableQuoteHtml(
      quote,
      siteName,
      contactEmail,
      contactPhone,
      address
    );

    // Return HTML response
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    adminLogger.error('Failed to generate printable quote', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse('Failed to generate printable quote', { status: 500 });
  }
}
