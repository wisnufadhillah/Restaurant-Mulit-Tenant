import { ConflictException, Injectable, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { assertKnowledgePublishable } from "./knowledge-publication";

/** Internal persistence boundary. Callers must authenticate tenant and publication authority. */
@Injectable()
export class KnowledgePublicationRepository implements OnModuleDestroy {
  private readonly db = createDatabaseClient();

  publish(tenantId: string, documentId: string, revision: number) {
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM knowledge_documents WHERE tenant_id = ${tenantId}::uuid AND id = ${documentId}::uuid FOR UPDATE`;
      const document = await tx.knowledgeDocument.findUnique({ where: { tenantId_id: { tenantId, id: documentId } } });
      if (!document) throw new NotFoundException();
      await tx.$executeRaw`SELECT revision FROM knowledge_document_revisions WHERE tenant_id = ${tenantId}::uuid AND document_id = ${documentId}::uuid AND revision = ${revision} FOR UPDATE`;
      const row = await tx.knowledgeDocumentRevision.findUnique({ where: { tenantId_documentId_revision: { tenantId, documentId, revision } }, include: { chunks: { orderBy: { position: "asc" } } } });
      if (!row) throw new NotFoundException();
      try { assertKnowledgePublishable(row, new Date()); } catch { throw new ConflictException("Knowledge approval does not match content"); }
      // Release the immediate partial unique index before publishing its replacement.
      await tx.knowledgeDocumentRevision.updateMany({ where: { tenantId, documentId, status: "published", revision: { not: revision } }, data: { status: "unpublished" } });
      await tx.knowledgeDocumentRevision.update({ where: { tenantId_documentId_revision: { tenantId, documentId, revision } }, data: { status: "published", publishedAt: row.publishedAt ?? new Date() } });
      await tx.knowledgeDocument.update({ where: { tenantId_id: { tenantId, id: documentId } }, data: { activeRevision: revision } });
      return { documentId, revision };
    }, { isolationLevel: "ReadCommitted", maxWait: 2000, timeout: 5000 });
  }

  unpublish(tenantId: string, documentId: string) {
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM knowledge_documents WHERE tenant_id = ${tenantId}::uuid AND id = ${documentId}::uuid FOR UPDATE`;
      const document = await tx.knowledgeDocument.findUnique({ where: { tenantId_id: { tenantId, id: documentId } } });
      if (!document) throw new NotFoundException();
      await tx.knowledgeDocument.update({ where: { tenantId_id: { tenantId, id: documentId } }, data: { activeRevision: null } });
      await tx.knowledgeDocumentRevision.updateMany({ where: { tenantId, documentId, status: "published" }, data: { status: "unpublished" } });
    }, { isolationLevel: "ReadCommitted", maxWait: 2000, timeout: 5000 });
  }

  async onModuleDestroy() { await this.db.$disconnect(); }
}
