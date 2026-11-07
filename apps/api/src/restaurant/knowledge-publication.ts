import { createHash } from "node:crypto";

export interface KnowledgeContent {
  title: string;
  chunks: { position: number; text: string }[];
}

export function knowledgeContentHash(content: KnowledgeContent): string {
  if (!content || typeof content.title !== "string" || !content.title.trim() || content.title.length > 200 || !Array.isArray(content.chunks) || content.chunks.length < 1 || content.chunks.length > 100) throw new Error("Invalid knowledge content");
  const ordered = [...content.chunks].sort((a, b) => a.position - b.position);
  for (let index = 0; index < ordered.length; index++) {
    const chunk = ordered[index];
    if (!chunk || chunk.position !== index || typeof chunk.text !== "string" || !chunk.text.trim() || chunk.text.length > 2000) throw new Error("Invalid knowledge content");
  }
  return createHash("sha256").update(JSON.stringify(["knowledge-content-v1", content.title, ordered.map(chunk => [chunk.position, chunk.text])])).digest("hex");
}

export function assertKnowledgePublishable(revision: KnowledgeContent & {
  contentHash: string;
  approvedHash: string | null;
  approvedAt: Date | null;
  approvalReference: string | null;
}, now: Date): void {
  const actual = knowledgeContentHash(revision);
  if (!Number.isFinite(now.getTime()) || actual !== revision.contentHash || actual !== revision.approvedHash ||
    !revision.approvedAt || !Number.isFinite(revision.approvedAt.getTime()) || revision.approvedAt > now ||
    typeof revision.approvalReference !== "string" || !revision.approvalReference.trim() || revision.approvalReference.length > 200) throw new Error("Knowledge content lacks matching approval");
}
