import { Injectable, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { KnowledgeRevision, searchKnowledge } from "./knowledge-search";

@Injectable()
export class KnowledgeRepository implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  search(slug: string, query: string) {
    return this.db.$transaction(async tx => {
      const tenant = await tx.tenant.findFirst({ where: { slug, status: "active" }, select: { id: true } });
      if (!tenant) throw new NotFoundException();
      const documents = await tx.knowledgeDocument.findMany({ where: { tenantId: tenant.id, activeRevision: { not: null } }, orderBy: { id: "asc" }, take: 101,
        select: { id: true, activeRevision: true, active: { select: { tenantId: true, documentId: true, revision: true, status: true, title: true, chunks: { take: 101, orderBy: { position: "asc" }, select: { position: true, text: true } } } } } });
      if (documents.length > 100) throw new Error("Knowledge snapshot limit exceeded");
      const rows: KnowledgeRevision[] = [];
      let characters = 0;
      for (const document of documents) {
        const row = document.active;
        if (!row || row.tenantId !== tenant.id || row.documentId !== document.id || row.revision !== document.activeRevision || row.status !== "published") throw new Error("Inconsistent knowledge snapshot");
        if (row.chunks.length > 100) throw new Error("Knowledge chunk limit exceeded");
        characters += row.title.length + row.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
        if (characters > 200000) throw new Error("Knowledge text budget exceeded");
        rows.push({ tenantId: tenant.id, documentId: row.documentId, revision: row.revision, activeRevision: document.activeRevision!, status: "published", title: row.title, chunks: row.chunks });
      }
      const result = { data: searchKnowledge(tenant.id, query, rows), source: "restaurant_knowledge" as const };
      if (Buffer.byteLength(JSON.stringify(result), "utf8") > 24000) throw new Error("Knowledge response limit exceeded");
      return result;
    }, { isolationLevel: "RepeatableRead", maxWait: 2000, timeout: 5000 });
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
