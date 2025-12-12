import { prisma, isDatabaseEnabled } from './prisma';
import { sendEmail } from './gmail';
import { adminLogger } from './logger';

// Define types locally to avoid Prisma client dependency issues during build
type NotificationType =
  | 'INTERNAL_QUOTE_CREATED'
  | 'INTERNAL_QUOTE_STATUS_CHANGE'
  | 'INTERNAL_USER_VERIFICATION'
  | 'INTERNAL_ARTWORK_RESPONSE'
  | 'CUSTOMER_QUOTE_SENT'
  | 'CUSTOMER_QUOTE_STATUS_CHANGE'
  | 'CUSTOMER_ARTWORK_APPROVAL';

type NotificationChannel = 'EMAIL' | 'SMS';

type NotificationContext = {
  quote?: {
    id: string;
    quoteNumber: string;
    total: string | number;
    status: string;
    customerName?: string | null;
    customerEmail?: string | null;
    customerCompany?: string | null;
    title?: string | null;
    validUntil?: string | null;
  };
  customer?: {
    id: string;
    contactName: string;
    email: string;
    companyName?: string | null;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  previousStatus?: string;
  newStatus?: string;
  artwork?: {
    url: string;
    fileName: string;
    version: number;
    approvalUrl: string;
    notes?: string | null;
    action?: 'approved' | 'declined';
  };
};

// Default email templates
const DEFAULT_TEMPLATES: Record<NotificationType, { subject: string; body: string }> = {
  INTERNAL_QUOTE_CREATED: {
    subject: 'New Quote Created: {{quoteNumber}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">New Quote Created</h2>
        <p>A new quote has been created in the system.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Quote Number:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{quoteNumber}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Customer:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{customerName}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Company:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{customerCompany}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Total:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{quoteTotal}}</td></tr>
        </table>
        <p style="color: #64748b; font-size: 14px;">Log in to the admin dashboard to view the full quote details.</p>
      </div>
    `,
  },
  INTERNAL_QUOTE_STATUS_CHANGE: {
    subject: 'Quote Status Changed: {{quoteNumber}} - {{newStatus}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">Quote Status Updated</h2>
        <p>A quote status has been changed.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Quote Number:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{quoteNumber}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Customer:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{customerName}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Previous Status:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{previousStatus}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>New Status:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong style="color: #0891b2;">{{newStatus}}</strong></td></tr>
        </table>
      </div>
    `,
  },
  INTERNAL_USER_VERIFICATION: {
    subject: 'Verify Your Email - Logoz Custom Admin',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">Email Verification</h2>
        <p>Hello {{userName}},</p>
        <p>Please verify your email address to access the Logoz Custom admin dashboard.</p>
        <p>If you did not request this verification, please ignore this email.</p>
      </div>
    `,
  },
  CUSTOMER_QUOTE_SENT: {
    subject: 'Your Quote from Logoz Custom - {{quoteNumber}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2 0%, #1e40af 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Logoz Custom</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Your Quote is Ready</h2>
          <p>Hello {{customerName}},</p>
          <p>Thank you for your interest in our services. We've prepared a quote for you.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden;">
            <tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><strong>Quote Number:</strong></td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">{{quoteNumber}}</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><strong>Project:</strong></td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">{{quoteTitle}}</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><strong>Total:</strong></td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><strong style="color: #0891b2; font-size: 18px;">{{quoteTotal}}</strong></td></tr>
            <tr><td style="padding: 12px;"><strong>Valid Until:</strong></td><td style="padding: 12px;">{{validUntil}}</td></tr>
          </table>
          <p>If you have any questions or would like to proceed, please don't hesitate to contact us.</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Thank you for choosing Logoz Custom!</p>
        </div>
      </div>
    `,
  },
  CUSTOMER_QUOTE_STATUS_CHANGE: {
    subject: 'Quote Update - {{quoteNumber}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2 0%, #1e40af 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Logoz Custom</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Quote Status Update</h2>
          <p>Hello {{customerName}},</p>
          <p>There has been an update to your quote.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden;">
            <tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><strong>Quote Number:</strong></td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">{{quoteNumber}}</td></tr>
            <tr><td style="padding: 12px;"><strong>Status:</strong></td><td style="padding: 12px;"><strong style="color: #0891b2;">{{newStatus}}</strong></td></tr>
          </table>
          <p>If you have any questions, please contact us.</p>
        </div>
      </div>
    `,
  },
  CUSTOMER_ARTWORK_APPROVAL: {
    subject: 'Artwork Ready for Review - {{quoteNumber}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0891b2 0%, #1e40af 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Logoz Custom</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc;">
          <h2 style="color: #1e293b;">Your Artwork is Ready for Review</h2>
          <p>Hello {{customerName}},</p>
          <p>We've prepared the artwork for your order and it's ready for your approval.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border-radius: 8px; overflow: hidden;">
            <tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><strong>Quote Number:</strong></td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">{{quoteNumber}}</td></tr>
            <tr><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><strong>Project:</strong></td><td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">{{quoteTitle}}</td></tr>
            <tr><td style="padding: 12px;"><strong>Artwork Version:</strong></td><td style="padding: 12px;">{{artworkVersion}}</td></tr>
          </table>
          <p style="text-align: center; margin: 30px 0;">
            <a href="{{artworkApprovalUrl}}" style="display: inline-block; background: linear-gradient(135deg, #0891b2 0%, #1e40af 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Take Me to the Quote</a>
          </p>
          <p style="color: #64748b; font-size: 14px;">Click the button above to view your quote and artwork. You can approve it if everything looks good, or request changes if you need any modifications.</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 20px;">If you have any questions, please don't hesitate to contact us.</p>
        </div>
      </div>
    `,
  },
  INTERNAL_ARTWORK_RESPONSE: {
    subject: '{{artworkAction}} - Artwork Response for {{quoteNumber}}',
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">Artwork {{artworkAction}}</h2>
        <p>Customer has responded to the artwork approval request.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Quote Number:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{quoteNumber}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Customer:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{customerName}}</td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Response:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>{{artworkAction}}</strong></td></tr>
          <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Notes:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">{{artworkNotes}}</td></tr>
        </table>
        <p style="color: #64748b; font-size: 14px;">Log in to the admin dashboard to view details and take next steps.</p>
      </div>
    `,
  },
};

// Replace template placeholders with actual values
function processTemplate(template: string, context: NotificationContext): string {
  let result = template;

  // Quote placeholders
  if (context.quote) {
    result = result.replace(/\{\{quoteNumber\}\}/g, context.quote.quoteNumber || '');
    result = result.replace(/\{\{quoteTotal\}\}/g, formatCurrency(context.quote.total));
    result = result.replace(/\{\{quoteTitle\}\}/g, context.quote.title || 'N/A');
    result = result.replace(/\{\{quoteStatus\}\}/g, context.quote.status || '');
    result = result.replace(/\{\{validUntil\}\}/g, context.quote.validUntil ? new Date(context.quote.validUntil).toLocaleDateString('en-US') : 'N/A');
    result = result.replace(/\{\{customerName\}\}/g, context.quote.customerName || context.customer?.contactName || 'Valued Customer');
    result = result.replace(/\{\{customerCompany\}\}/g, context.quote.customerCompany || context.customer?.companyName || 'N/A');
    result = result.replace(/\{\{customerEmail\}\}/g, context.quote.customerEmail || context.customer?.email || '');
  }

  // Customer placeholders
  if (context.customer) {
    result = result.replace(/\{\{customerName\}\}/g, context.customer.contactName || '');
    result = result.replace(/\{\{customerEmail\}\}/g, context.customer.email || '');
    result = result.replace(/\{\{customerCompany\}\}/g, context.customer.companyName || '');
  }

  // User placeholders
  if (context.user) {
    result = result.replace(/\{\{userName\}\}/g, context.user.name || '');
    result = result.replace(/\{\{userEmail\}\}/g, context.user.email || '');
  }

  // Status change placeholders
  result = result.replace(/\{\{previousStatus\}\}/g, context.previousStatus || '');
  result = result.replace(/\{\{newStatus\}\}/g, context.newStatus || '');

  // Artwork placeholders
  if (context.artwork) {
    result = result.replace(/\{\{artworkUrl\}\}/g, context.artwork.url || '');
    result = result.replace(/\{\{artworkFileName\}\}/g, context.artwork.fileName || '');
    result = result.replace(/\{\{artworkVersion\}\}/g, String(context.artwork.version || 1));
    result = result.replace(/\{\{artworkApprovalUrl\}\}/g, context.artwork.approvalUrl || '');
    result = result.replace(/\{\{artworkNotes\}\}/g, context.artwork.notes || 'No notes provided');
    result = result.replace(/\{\{artworkAction\}\}/g, context.artwork.action === 'approved' ? 'Approved' : 'Declined');
  }

  return result;
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
}

// Get notification setting
async function getNotificationSetting(type: NotificationType) {
  if (!isDatabaseEnabled) return null;

  try {
    const setting = await prisma.notificationSetting.findUnique({
      where: { type },
    });

    return setting;
  } catch (error) {
    adminLogger.error('Failed to get notification setting', {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// Log notification
async function logNotification(
  type: NotificationType,
  channel: NotificationChannel,
  recipientEmail: string,
  subject: string,
  body: string,
  status: 'pending' | 'sent' | 'failed',
  context: NotificationContext,
  errorMessage?: string
) {
  try {
    await prisma.notificationLog.create({
      data: {
        type,
        channel,
        recipientEmail,
        recipientName: context.customer?.contactName || context.quote?.customerName || context.user?.name,
        subject,
        body,
        status,
        errorMessage,
        sentAt: status === 'sent' ? new Date() : null,
        quoteId: context.quote?.id,
        customerId: context.customer?.id,
        userId: context.user?.id,
      },
    });
  } catch (error) {
    adminLogger.error('Failed to log notification', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Send a notification
export async function sendNotification(
  type: NotificationType,
  context: NotificationContext,
  overrideRecipient?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  const setting = await getNotificationSetting(type);

  if (!setting || !setting.enabled) {
    adminLogger.info('Notification skipped - disabled or not configured', { type });
    return { success: true }; // Not an error, just disabled
  }

  const defaultTemplate = DEFAULT_TEMPLATES[type];
  const subject = processTemplate(setting.subject || defaultTemplate.subject, context);
  const body = processTemplate(setting.bodyTemplate || defaultTemplate.body, context);

  // Determine recipients
  let recipients: string[] = [];

  if (overrideRecipient) {
    recipients = [overrideRecipient];
  } else if (type.startsWith('INTERNAL_')) {
    // Internal notifications go to configured recipient emails
    recipients = setting.recipientEmails || [];
  } else {
    // External notifications go to customer email
    const customerEmail = context.quote?.customerEmail || context.customer?.email;
    if (customerEmail) {
      recipients = [customerEmail];
    }
  }

  if (recipients.length === 0) {
    adminLogger.warn('No recipients for notification', { type });
    return { success: false, error: 'No recipients configured' };
  }

  // Send to all recipients
  const results = await Promise.all(
    recipients.map(async (recipient) => {
      if (setting.channel === 'EMAIL') {
        const result = await sendEmail({
          to: recipient,
          subject,
          body,
          isHtml: true,
        });

        await logNotification(
          type,
          'EMAIL',
          recipient,
          subject,
          body,
          result.success ? 'sent' : 'failed',
          context,
          result.error
        );

        return result;
      }

      // SMS support for future
      return { success: false, error: 'SMS not yet implemented' };
    })
  );

  const allSuccessful = results.every((r: { success: boolean; error?: string }) => r.success);
  const errors = results.filter((r: { success: boolean; error?: string }) => !r.success).map((r: { success: boolean; error?: string }) => r.error);

  return {
    success: allSuccessful,
    error: errors.length > 0 ? errors.join(', ') : undefined,
  };
}

// Convenience functions for specific notification types
export async function notifyQuoteCreated(quote: NotificationContext['quote']) {
  return sendNotification('INTERNAL_QUOTE_CREATED', { quote });
}

export async function notifyQuoteStatusChange(
  quote: NotificationContext['quote'],
  previousStatus: string,
  newStatus: string,
  sendToCustomer = true
) {
  const context = { quote, previousStatus, newStatus };

  // Send internal notification
  await sendNotification('INTERNAL_QUOTE_STATUS_CHANGE', context);

  // Send customer notification if enabled and requested
  if (sendToCustomer && quote?.customerEmail) {
    await sendNotification('CUSTOMER_QUOTE_STATUS_CHANGE', context);
  }
}

export async function notifyQuoteSentToCustomer(quote: NotificationContext['quote']) {
  if (!quote?.customerEmail) {
    return { success: false, error: 'No customer email' };
  }

  return sendNotification('CUSTOMER_QUOTE_SENT', { quote });
}

export async function notifyUserVerification(user: NotificationContext['user']) {
  if (!user?.email) {
    return { success: false, error: 'No user email' };
  }

  return sendNotification('INTERNAL_USER_VERIFICATION', { user }, user.email);
}

// Notify quote owner when customer approves/declines
export async function notifyQuoteOwnerStatusChange(
  quote: NotificationContext['quote'],
  owner: NotificationContext['owner'],
  previousStatus: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  if (!owner?.email) {
    adminLogger.info('No owner email for quote notification', { quoteId: quote?.id });
    return { success: true }; // Not an error, just no owner assigned
  }

  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  const isApproved = newStatus === 'APPROVED';
  const statusColor = isApproved ? '#16a34a' : '#dc2626';
  const statusLabel = isApproved ? 'Approved' : 'Declined';
  const emoji = isApproved ? '✅' : '❌';

  const subject = `${emoji} Quote ${quote?.quoteNumber} ${statusLabel} by Customer`;

  const body = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">Quote Status Update</h1>
      </div>

      <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <p style="margin: 0 0 20px 0; color: #1e293b; font-size: 16px;">Hi ${owner.name},</p>

        <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
          ${isApproved
            ? 'Great news! Your customer has approved the quote.'
            : 'Your customer has declined the quote.'}
        </p>

        <div style="background: ${isApproved ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isApproved ? '#bbf7d0' : '#fecaca'}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 24px; margin-right: 12px;">${emoji}</span>
            <span style="color: ${statusColor}; font-size: 18px; font-weight: 700;">${statusLabel}</span>
          </div>
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Quote Number:</td>
              <td style="padding: 6px 0; color: #1e293b; font-weight: 500;">${quote?.quoteNumber}</td>
            </tr>
            ${quote?.title ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Title:</td>
              <td style="padding: 6px 0; color: #1e293b; font-weight: 500;">${quote.title}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Customer:</td>
              <td style="padding: 6px 0; color: #1e293b; font-weight: 500;">${quote?.customerName || 'N/A'}${quote?.customerCompany ? ` (${quote.customerCompany})` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Total:</td>
              <td style="padding: 6px 0; color: #0891b2; font-weight: 700; font-size: 16px;">${formatCurrency(quote?.total || 0)}</td>
            </tr>
          </table>
        </div>

        <p style="margin: 0; color: #64748b; font-size: 14px;">
          ${isApproved
            ? 'You can now proceed with the order. Log in to the admin dashboard to view details and take next steps.'
            : 'You may want to follow up with the customer to discuss any concerns or alternative options.'}
        </p>
      </div>

      <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
        This notification was sent because you are the owner of this quote.
      </p>
    </div>
  `.trim();

  try {
    const result = await sendEmail({
      to: owner.email,
      subject,
      body,
      isHtml: true,
    });

    await logNotification(
      'INTERNAL_QUOTE_STATUS_CHANGE',
      'EMAIL',
      owner.email,
      subject,
      body,
      result.success ? 'sent' : 'failed',
      { quote, owner, previousStatus, newStatus },
      result.error
    );

    if (result.success) {
      adminLogger.info('Quote owner notified of status change', {
        quoteId: quote?.id,
        ownerId: owner.id,
        newStatus,
      });
    }

    return result;
  } catch (error) {
    adminLogger.error('Failed to notify quote owner', {
      quoteId: quote?.id,
      ownerId: owner.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Notify customer that artwork is ready for approval
// This function sends email directly without checking notification settings
// because it's triggered by an explicit user action (clicking mail icon)
export async function notifyArtworkForApproval(
  quote: NotificationContext['quote'],
  artwork: NotificationContext['artwork']
): Promise<{ success: boolean; error?: string }> {
  if (!quote?.customerEmail) {
    return { success: false, error: 'No customer email' };
  }

  if (!isDatabaseEnabled) {
    return { success: false, error: 'Database not configured' };
  }

  // Build email using default template
  const defaultTemplate = DEFAULT_TEMPLATES.CUSTOMER_ARTWORK_APPROVAL;
  const context: NotificationContext = { quote, artwork };
  const subject = processTemplate(defaultTemplate.subject, context);
  const body = processTemplate(defaultTemplate.body, context);

  try {
    const result = await sendEmail({
      to: quote.customerEmail,
      subject,
      body,
      isHtml: true,
    });

    // Log the notification
    await logNotification(
      'CUSTOMER_ARTWORK_APPROVAL',
      'EMAIL',
      quote.customerEmail,
      subject,
      body,
      result.success ? 'sent' : 'failed',
      context,
      result.error
    );

    if (result.success) {
      adminLogger.info('Artwork approval email sent', {
        quoteId: quote.id,
        customerEmail: quote.customerEmail,
        artworkVersion: artwork?.version,
      });
    }

    return result;
  } catch (error) {
    adminLogger.error('Failed to send artwork approval email', {
      quoteId: quote.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Notify internal team when customer responds to artwork
export async function notifyArtworkResponse(
  quote: NotificationContext['quote'],
  owner: NotificationContext['owner'],
  artwork: NotificationContext['artwork']
): Promise<{ success: boolean; error?: string }> {
  // Send internal notification
  const result = await sendNotification('INTERNAL_ARTWORK_RESPONSE', { quote, artwork });

  // Also notify the quote owner directly if they have an email
  if (owner?.email) {
    const isApproved = artwork?.action === 'approved';
    const statusColor = isApproved ? '#16a34a' : '#f59e0b';
    const statusLabel = isApproved ? 'Approved' : 'Needs Changes';
    const emoji = isApproved ? '✅' : '🎨';

    const subject = `${emoji} Artwork ${statusLabel} - ${quote?.quoteNumber}`;

    const body = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); padding: 24px 32px; border-radius: 12px 12px 0 0;">
          <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">Artwork ${statusLabel}</h1>
        </div>

        <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <p style="margin: 0 0 20px 0; color: #1e293b; font-size: 16px;">Hi ${owner.name},</p>

          <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
            ${isApproved
              ? 'Your customer has approved the artwork! You can now proceed with production.'
              : 'Your customer has requested changes to the artwork.'}
          </p>

          <div style="background: ${isApproved ? '#f0fdf4' : '#fef3c7'}; border: 1px solid ${isApproved ? '#bbf7d0' : '#fcd34d'}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
              <span style="font-size: 24px; margin-right: 12px;">${emoji}</span>
              <span style="color: ${statusColor}; font-size: 18px; font-weight: 700;">${statusLabel}</span>
            </div>
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Quote Number:</td>
                <td style="padding: 6px 0; color: #1e293b; font-weight: 500;">${quote?.quoteNumber}</td>
              </tr>
              ${quote?.title ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Title:</td>
                <td style="padding: 6px 0; color: #1e293b; font-weight: 500;">${quote.title}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Customer:</td>
                <td style="padding: 6px 0; color: #1e293b; font-weight: 500;">${quote?.customerName || 'N/A'}</td>
              </tr>
              ${artwork?.notes ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Customer Notes:</td>
                <td style="padding: 6px 0; color: #1e293b;">${artwork.notes}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <p style="margin: 0; color: #64748b; font-size: 14px;">
            ${isApproved
              ? 'Log in to the admin dashboard to proceed with the order.'
              : 'Log in to the admin dashboard to review the feedback and upload revised artwork.'}
          </p>
        </div>
      </div>
    `.trim();

    try {
      await sendEmail({
        to: owner.email,
        subject,
        body,
        isHtml: true,
      });
    } catch (error) {
      adminLogger.error('Failed to notify artwork response to owner', {
        quoteId: quote?.id,
        ownerId: owner.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

// Initialize default notification settings
export async function initializeNotificationSettings() {
  if (!isDatabaseEnabled) return;

  const defaultSettings = [
    {
      type: 'INTERNAL_QUOTE_CREATED' as NotificationType,
      name: 'Quote Generation (Internal)',
      description: 'Notify internal users when a new quote is created',
      channel: 'EMAIL' as NotificationChannel,
      enabled: false,
    },
    {
      type: 'INTERNAL_QUOTE_STATUS_CHANGE' as NotificationType,
      name: 'Quote Status Change (Internal)',
      description: 'Notify internal users when a quote status changes',
      channel: 'EMAIL' as NotificationChannel,
      enabled: false,
    },
    {
      type: 'INTERNAL_USER_VERIFICATION' as NotificationType,
      name: 'User Email Verification',
      description: 'Send verification emails to new admin users',
      channel: 'EMAIL' as NotificationChannel,
      enabled: false,
    },
    {
      type: 'CUSTOMER_QUOTE_SENT' as NotificationType,
      name: 'Customer Quote Delivery',
      description: 'Send quotes to customer email addresses',
      channel: 'EMAIL' as NotificationChannel,
      enabled: false,
    },
    {
      type: 'CUSTOMER_QUOTE_STATUS_CHANGE' as NotificationType,
      name: 'Customer Quote Status Update',
      description: 'Notify customers when their quote status changes',
      channel: 'EMAIL' as NotificationChannel,
      enabled: false,
    },
    {
      type: 'CUSTOMER_ARTWORK_APPROVAL' as NotificationType,
      name: 'Customer Artwork Approval Request',
      description: 'Send artwork to customers for approval',
      channel: 'EMAIL' as NotificationChannel,
      enabled: false,
    },
    {
      type: 'INTERNAL_ARTWORK_RESPONSE' as NotificationType,
      name: 'Artwork Response (Internal)',
      description: 'Notify internal team when customer responds to artwork',
      channel: 'EMAIL' as NotificationChannel,
      enabled: false,
    },
  ];

  for (const setting of defaultSettings) {
    try {
      await prisma.notificationSetting.upsert({
        where: { type: setting.type },
        update: {},
        create: setting,
      });
    } catch (error) {
      adminLogger.error('Failed to initialize notification setting', {
        type: setting.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
