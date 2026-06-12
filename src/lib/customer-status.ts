import { prisma, isDatabaseEnabled } from './prisma';
import { adminLogger } from './logger';

/**
 * Advance a customer from LEAD/PROSPECT to ACTIVE once they have an approved
 * quote. Idempotent and atomic — a no-op when there is no linked customer or
 * the customer is already past the lead stage.
 */
export async function activateCustomerOnApproval(
  customerId: string | null | undefined
): Promise<void> {
  if (!customerId || !isDatabaseEnabled) return;

  try {
    await prisma.customer.updateMany({
      where: { id: customerId, status: { in: ['LEAD', 'PROSPECT'] } },
      data: { status: 'ACTIVE' },
    });
  } catch (error) {
    adminLogger.error('Failed to activate customer on quote approval', {
      customerId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
