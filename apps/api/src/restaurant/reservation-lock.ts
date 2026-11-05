import { Prisma } from "../generated/prisma/client";

export async function lockReservationTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}::text, 0))`;
}
