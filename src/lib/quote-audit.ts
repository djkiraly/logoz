import { prisma, isDatabaseEnabled } from './prisma';
import { adminLogger } from './logger';
import { Prisma } from '@prisma/client';

// Types matching Prisma enums
type QuoteAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'STATUS_CHANGED'
  | 'SENT_TO_CUSTOMER'
  | 'APPROVED_BY_CUSTOMER'
  | 'DECLINED_BY_CUSTOMER'
  | 'LINE_ITEM_ADDED'
  | 'LINE_ITEM_UPDATED'
  | 'LINE_ITEM_REMOVED'
  | 'CUSTOMER_CHANGED'
  | 'OWNER_CHANGED'
  | 'PRICING_UPDATED'
  | 'DELETED'
  | 'ARTWORK_UPLOADED'
  | 'ARTWORK_SENT_TO_CUSTOMER'
  | 'ARTWORK_APPROVED_BY_CUSTOMER'
  | 'ARTWORK_DECLINED_BY_CUSTOMER'
  | 'ARTWORK_UPDATED';

type QuoteAuditActorType = 'ADMIN' | 'CUSTOMER' | 'SYSTEM';

type AuditLogParams = {
  quoteId: string;
  action: QuoteAuditAction;
  description: string;
  actorType?: QuoteAuditActorType;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Log an audit entry for a quote
 */
export async function logQuoteAudit(params: AuditLogParams): Promise<void> {
  if (!isDatabaseEnabled) return;

  try {
    await prisma.quoteAuditLog.create({
      data: {
        quoteId: params.quoteId,
        action: params.action,
        description: params.description,
        actorType: params.actorType || 'SYSTEM',
        actorId: params.actorId || null,
        actorName: params.actorName || null,
        actorEmail: params.actorEmail || null,
        previousValue: params.previousValue
          ? (params.previousValue as Prisma.InputJsonValue)
          : Prisma.DbNull,
        newValue: params.newValue
          ? (params.newValue as Prisma.InputJsonValue)
          : Prisma.DbNull,
        metadata: params.metadata
          ? (params.metadata as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
  } catch (error) {
    adminLogger.error('Failed to log quote audit entry', {
      quoteId: params.quoteId,
      action: params.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Log quote creation
 */
export async function logQuoteCreated(
  quoteId: string,
  quoteNumber: string,
  actor: { id: string; name: string; email: string },
  quoteData: Record<string, unknown>
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'CREATED',
    description: `Quote ${quoteNumber} created`,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    newValue: quoteData,
  });
}

/**
 * Log quote status change
 */
export async function logQuoteStatusChange(
  quoteId: string,
  quoteNumber: string,
  previousStatus: string,
  newStatus: string,
  actor: { type: QuoteAuditActorType; id?: string; name?: string; email?: string }
): Promise<void> {
  const actionMap: Record<string, QuoteAuditAction> = {
    'SENT': 'SENT_TO_CUSTOMER',
    'APPROVED': 'APPROVED_BY_CUSTOMER',
    'DECLINED': 'DECLINED_BY_CUSTOMER',
  };

  const action = actionMap[newStatus] || 'STATUS_CHANGED';
  const actorDesc = actor.type === 'CUSTOMER' ? 'customer' : actor.name || 'system';

  await logQuoteAudit({
    quoteId,
    action,
    description: `Status changed from ${previousStatus} to ${newStatus} by ${actorDesc}`,
    actorType: actor.type,
    actorId: actor.id || null,
    actorName: actor.name || null,
    actorEmail: actor.email || null,
    previousValue: { status: previousStatus },
    newValue: { status: newStatus },
  });
}

/**
 * Log quote sent to customer
 */
export async function logQuoteSent(
  quoteId: string,
  quoteNumber: string,
  recipientEmail: string,
  actor: { id: string; name: string; email: string }
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'SENT_TO_CUSTOMER',
    description: `Quote sent to ${recipientEmail}`,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    metadata: { recipientEmail },
  });
}

/**
 * Log line items changes
 */
export async function logLineItemsChanged(
  quoteId: string,
  quoteNumber: string,
  previousItems: Array<{ name: string; quantity: number; unitPrice: number }>,
  newItems: Array<{ name: string; quantity: number; unitPrice: number }>,
  actor: { id: string; name: string; email: string }
): Promise<void> {
  const prevCount = previousItems.length;
  const newCount = newItems.length;

  let action: QuoteAuditAction = 'UPDATED';
  let description = 'Line items updated';

  if (prevCount === 0 && newCount > 0) {
    action = 'LINE_ITEM_ADDED';
    description = `${newCount} line item(s) added`;
  } else if (newCount > prevCount) {
    action = 'LINE_ITEM_ADDED';
    description = `${newCount - prevCount} line item(s) added`;
  } else if (newCount < prevCount) {
    action = 'LINE_ITEM_REMOVED';
    description = `${prevCount - newCount} line item(s) removed`;
  } else {
    action = 'LINE_ITEM_UPDATED';
    description = 'Line items modified';
  }

  await logQuoteAudit({
    quoteId,
    action,
    description,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    previousValue: { itemCount: prevCount, items: previousItems.map(i => i.name) },
    newValue: { itemCount: newCount, items: newItems.map(i => i.name) },
  });
}

/**
 * Log customer change
 */
export async function logCustomerChanged(
  quoteId: string,
  quoteNumber: string,
  previousCustomer: { name?: string | null; email?: string | null } | null,
  newCustomer: { name?: string | null; email?: string | null } | null,
  actor: { id: string; name: string; email: string }
): Promise<void> {
  const prevName = previousCustomer?.name || previousCustomer?.email || 'None';
  const newName = newCustomer?.name || newCustomer?.email || 'None';

  await logQuoteAudit({
    quoteId,
    action: 'CUSTOMER_CHANGED',
    description: `Customer changed from "${prevName}" to "${newName}"`,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    previousValue: previousCustomer,
    newValue: newCustomer,
  });
}

/**
 * Log owner change
 */
export async function logOwnerChanged(
  quoteId: string,
  quoteNumber: string,
  previousOwner: { name?: string | null } | null,
  newOwner: { name?: string | null } | null,
  actor: { id: string; name: string; email: string }
): Promise<void> {
  const prevName = previousOwner?.name || 'Unassigned';
  const newName = newOwner?.name || 'Unassigned';

  await logQuoteAudit({
    quoteId,
    action: 'OWNER_CHANGED',
    description: `Owner changed from "${prevName}" to "${newName}"`,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    previousValue: { owner: prevName },
    newValue: { owner: newName },
  });
}

/**
 * Log pricing update
 */
export async function logPricingUpdated(
  quoteId: string,
  quoteNumber: string,
  previousPricing: { subtotal?: number; discount?: number; tax?: number; total?: number },
  newPricing: { subtotal?: number; discount?: number; tax?: number; total?: number },
  actor: { id: string; name: string; email: string }
): Promise<void> {
  const changes: string[] = [];
  if (previousPricing.discount !== newPricing.discount) changes.push('discount');
  if (previousPricing.tax !== newPricing.tax) changes.push('tax');
  if (previousPricing.subtotal !== newPricing.subtotal) changes.push('subtotal');
  if (previousPricing.total !== newPricing.total) changes.push('total');

  await logQuoteAudit({
    quoteId,
    action: 'PRICING_UPDATED',
    description: `Pricing updated: ${changes.join(', ')} changed`,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    previousValue: previousPricing,
    newValue: newPricing,
  });
}

/**
 * Log general quote update
 */
export async function logQuoteUpdated(
  quoteId: string,
  quoteNumber: string,
  changes: string[],
  actor: { id: string; name: string; email: string },
  previousValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'UPDATED',
    description: `Quote updated: ${changes.join(', ')}`,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    previousValue,
    newValue,
  });
}

/**
 * Get audit logs for a quote
 */
export async function getQuoteAuditLogs(quoteId: string) {
  if (!isDatabaseEnabled) return [];

  try {
    const logs = await prisma.quoteAuditLog.findMany({
      where: { quoteId },
      orderBy: { createdAt: 'desc' },
    });

    return logs;
  } catch (error) {
    adminLogger.error('Failed to fetch quote audit logs', {
      quoteId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ===========================================
// Artwork Approval Audit Functions
// ===========================================

/**
 * Log artwork uploaded
 */
export async function logArtworkUploaded(
  quoteId: string,
  quoteNumber: string,
  artworkFileName: string,
  artworkVersion: number,
  actor: { id: string; name: string; email: string },
  artworkUrl?: string
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'ARTWORK_UPLOADED',
    description: `Artwork "${artworkFileName}" uploaded (version ${artworkVersion})`,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    newValue: { artworkFileName, artworkVersion, artworkUrl },
  });
}

/**
 * Log artwork sent to customer for approval
 */
export async function logArtworkSentToCustomer(
  quoteId: string,
  quoteNumber: string,
  recipientEmail: string,
  artworkFileName: string,
  actor: { id: string; name: string; email: string }
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'ARTWORK_SENT_TO_CUSTOMER',
    description: `Artwork sent to ${recipientEmail} for approval`,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    metadata: { recipientEmail, artworkFileName },
  });
}

/**
 * Log artwork approved by customer
 */
export async function logArtworkApprovedByCustomer(
  quoteId: string,
  quoteNumber: string,
  customerEmail: string,
  notes?: string | null
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'ARTWORK_APPROVED_BY_CUSTOMER',
    description: notes
      ? `Artwork approved by customer with notes: "${notes.substring(0, 100)}${notes.length > 100 ? '...' : ''}"`
      : 'Artwork approved by customer',
    actorType: 'CUSTOMER',
    actorEmail: customerEmail,
    newValue: { approved: true, notes },
  });
}

/**
 * Log artwork declined by customer
 */
export async function logArtworkDeclinedByCustomer(
  quoteId: string,
  quoteNumber: string,
  customerEmail: string,
  notes?: string | null
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'ARTWORK_DECLINED_BY_CUSTOMER',
    description: notes
      ? `Artwork declined by customer: "${notes.substring(0, 100)}${notes.length > 100 ? '...' : ''}"`
      : 'Artwork declined by customer',
    actorType: 'CUSTOMER',
    actorEmail: customerEmail,
    newValue: { approved: false, notes },
  });
}

/**
 * Log artwork updated (new version uploaded)
 */
export async function logArtworkUpdated(
  quoteId: string,
  quoteNumber: string,
  previousFileName: string | null,
  newFileName: string,
  newVersion: number,
  actor: { id: string; name: string; email: string },
  newArtworkUrl?: string,
  previousArtworkUrl?: string | null
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'ARTWORK_UPDATED',
    description: `Artwork updated to version ${newVersion}: "${newFileName}"`,
    actorType: 'ADMIN',
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    previousValue: { artworkFileName: previousFileName, artworkUrl: previousArtworkUrl },
    newValue: { artworkFileName: newFileName, artworkVersion: newVersion, artworkUrl: newArtworkUrl },
  });
}

/**
 * Log quote approved by customer
 */
export async function logQuoteApprovedByCustomer(
  quoteId: string,
  quoteNumber: string,
  customerEmail: string
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'APPROVED_BY_CUSTOMER',
    description: `Quote approved by customer (${customerEmail})`,
    actorType: 'CUSTOMER',
    actorEmail: customerEmail,
    newValue: { approvedAt: new Date().toISOString() },
  });
}

/**
 * Log quote declined by customer
 */
export async function logQuoteDeclinedByCustomer(
  quoteId: string,
  quoteNumber: string,
  customerEmail: string,
  notes?: string
): Promise<void> {
  await logQuoteAudit({
    quoteId,
    action: 'DECLINED_BY_CUSTOMER',
    description: `Quote declined by customer (${customerEmail})${notes ? `: "${notes}"` : ''}`,
    actorType: 'CUSTOMER',
    actorEmail: customerEmail,
    newValue: { declinedAt: new Date().toISOString(), notes },
  });
}
