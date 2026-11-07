import { BadRequestException } from "@nestjs/common";

export interface KnowledgeRevision {
  tenantId: string;
  documentId: string;
  revision: number;
  activeRevision: number;
  status: "draft" | "published" | "unpublished";
  title: string;
  chunks: { position: number; text: string }[];
}
export interface KnowledgeExcerpt {
  documentId: string;
  revision: number;
  title: string;
  position: number;
  text: string;
}
const STOP = new Set("apa apakah bagaimana boleh bisa saya kami kita yang dan atau di ke dari untuk dengan itu ini ada tentang tolong mau ingin nya".split(" "));
function tokens(text: string): Set<string> {
  return new Set((text.normalize("NFKC").toLocaleLowerCase("id-ID").match(/[\p{L}\p{N}]+/gu) ?? []).filter(word => word.length >= 3 && !STOP.has(word)));
}

/** Return source data only, never an instruction or a generated policy answer. */
export function searchKnowledge(tenantId: string, query: unknown, revisions: readonly KnowledgeRevision[]): KnowledgeExcerpt[] {
  if (typeof tenantId !== "string" || !tenantId || tenantId.length > 128) throw new Error("Invalid trusted knowledge scope");
  if (typeof query !== "string" || query.length > 500 || !query.trim()) throw new BadRequestException("Invalid knowledge query");
  if (!Array.isArray(revisions) || revisions.length > 1000) throw new Error("Invalid knowledge corpus");
  // Exclude other tenants before validating content or assigning any score.
  const scoped = revisions.filter(row => row && row.tenantId === tenantId);
  const seen = new Set<string>();
  const active = new Map<string, number>();
  const eligible: KnowledgeRevision[] = [];
  for (const row of scoped) {
    if (typeof row.documentId !== "string" || !row.documentId || row.documentId.length > 128 ||
      !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isSafeInteger(row.activeRevision) || row.activeRevision < 1 ||
      !["draft", "published", "unpublished"].includes(row.status)) throw new Error("Invalid knowledge revision");
    const identity = JSON.stringify([row.documentId, row.revision]);
    if (seen.has(identity)) throw new Error("Ambiguous knowledge revision");
    seen.add(identity);
    const expected = active.get(row.documentId);
    if (expected !== undefined && expected !== row.activeRevision) throw new Error("Inconsistent active knowledge revision");
    active.set(row.documentId, row.activeRevision);
    if (row.status !== "published" || row.revision !== row.activeRevision) continue;
    if (typeof row.title !== "string" || !row.title.trim() || row.title.length > 200 || !Array.isArray(row.chunks) || row.chunks.length > 100) throw new Error("Invalid knowledge document");
    const positions = new Set<number>();
    for (const chunk of row.chunks) {
      if (!chunk || !Number.isSafeInteger(chunk.position) || chunk.position < 0 || positions.has(chunk.position) || typeof chunk.text !== "string" || !chunk.text.trim() || chunk.text.length > 2000) throw new Error("Invalid knowledge chunk");
      positions.add(chunk.position);
    }
    eligible.push(row);
  }
  const wanted = tokens(query);
  if (!wanted.size) return [];
  const candidates: { excerpt: KnowledgeExcerpt; score: number }[] = [];
  for (const row of eligible) {
    for (const chunk of row.chunks) {
      const words = tokens(`${row.title} ${chunk.text}`);
      const matches = [...wanted].filter(word => words.has(word)).length;
      // Short queries need all their terms; broader queries need at least two.
      if (matches < Math.min(2, wanted.size)) continue;
      candidates.push({ score: matches / wanted.size, excerpt: { documentId: row.documentId, revision: row.revision, title: row.title, position: chunk.position, text: chunk.text } });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || (a.excerpt.documentId < b.excerpt.documentId ? -1 : a.excerpt.documentId > b.excerpt.documentId ? 1 : a.excerpt.position - b.excerpt.position)).slice(0, 3).map(row => row.excerpt);
}
