BEGIN;

CREATE TABLE "knowledge_documents" (
  "id" UUID PRIMARY KEY,
  "tenant_id" UUID NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "active_revision" INTEGER CHECK ("active_revision" > 0),
  UNIQUE ("tenant_id", "id")
);

CREATE TABLE "knowledge_document_revisions" (
  "tenant_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "title" TEXT NOT NULL CHECK (length(trim("title")) BETWEEN 1 AND 200),
  "status" TEXT NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'published', 'unpublished')),
  "content_hash" TEXT NOT NULL CHECK ("content_hash" ~ '^[a-f0-9]{64}$'),
  "approved_hash" TEXT CHECK ("approved_hash" ~ '^[a-f0-9]{64}$'),
  "approved_at" TIMESTAMPTZ(3),
  "approval_reference" TEXT,
  "published_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("tenant_id", "document_id", "revision"),
  FOREIGN KEY ("tenant_id", "document_id") REFERENCES "knowledge_documents"("tenant_id", "id") ON DELETE RESTRICT,
  CHECK (("approved_at" IS NULL AND "approval_reference" IS NULL AND "approved_hash" IS NULL) OR
    ("approved_at" IS NOT NULL AND isfinite("approved_at") AND "approval_reference" IS NOT NULL AND length(trim("approval_reference")) BETWEEN 1 AND 200 AND "approved_hash" IS NOT NULL AND "approved_hash" = "content_hash")),
  CHECK ("status" <> 'published' OR ("approved_at" IS NOT NULL AND "published_at" IS NOT NULL)),
  CHECK ("published_at" IS NULL OR (isfinite("published_at") AND "approved_at" IS NOT NULL AND "published_at" >= "approved_at"))
);

ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_active_revision_fkey"
  FOREIGN KEY ("tenant_id", "id", "active_revision") REFERENCES "knowledge_document_revisions"("tenant_id", "document_id", "revision")
  ON DELETE NO ACTION ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE "knowledge_chunks" (
  "tenant_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "position" INTEGER NOT NULL CHECK ("position" BETWEEN 0 AND 99),
  "text" TEXT NOT NULL CHECK (length(trim("text")) BETWEEN 1 AND 2000),
  PRIMARY KEY ("tenant_id", "document_id", "revision", "position"),
  FOREIGN KEY ("tenant_id", "document_id", "revision") REFERENCES "knowledge_document_revisions"("tenant_id", "document_id", "revision") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "knowledge_document_revisions_single_published_idx"
  ON "knowledge_document_revisions"("tenant_id", "document_id") WHERE "status" = 'published';

CREATE FUNCTION protect_approved_knowledge_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.approved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Approved knowledge revision cannot be deleted' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.approved_at IS NOT NULL AND
    ROW(NEW.tenant_id, NEW.document_id, NEW.revision, NEW.title, NEW.content_hash, NEW.approved_hash, NEW.approved_at, NEW.approval_reference)
    IS DISTINCT FROM ROW(OLD.tenant_id, OLD.document_id, OLD.revision, OLD.title, OLD.content_hash, OLD.approved_hash, OLD.approved_at, OLD.approval_reference) THEN
    RAISE EXCEPTION 'Approved knowledge content is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER knowledge_revision_immutable BEFORE UPDATE OR DELETE ON knowledge_document_revisions
  FOR EACH ROW EXECUTE FUNCTION protect_approved_knowledge_revision();

CREATE FUNCTION protect_approved_knowledge_chunk() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t UUID; d UUID; r INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    t := NEW.tenant_id; d := NEW.document_id; r := NEW.revision;
  ELSE
    t := OLD.tenant_id; d := OLD.document_id; r := OLD.revision;
  END IF;
  -- Serialize chunk edits against approval/publication of the parent revision.
  PERFORM 1 FROM knowledge_document_revisions
    WHERE tenant_id = t AND document_id = d AND revision = r FOR UPDATE;
  IF EXISTS (SELECT 1 FROM knowledge_document_revisions WHERE tenant_id = t AND document_id = d AND revision = r AND approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Approved knowledge chunks are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND ROW(NEW.tenant_id, NEW.document_id, NEW.revision) IS DISTINCT FROM ROW(t, d, r) THEN
    RAISE EXCEPTION 'Knowledge chunk cannot move between revisions' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER knowledge_chunk_immutable BEFORE INSERT OR UPDATE OR DELETE ON knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION protect_approved_knowledge_chunk();

CREATE FUNCTION check_knowledge_publication() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t UUID; d UUID; pointer INTEGER;
BEGIN
  t := COALESCE(NEW.tenant_id, OLD.tenant_id);
  IF TG_TABLE_NAME = 'knowledge_documents' THEN d := COALESCE(NEW.id, OLD.id);
  ELSE d := COALESCE(NEW.document_id, OLD.document_id); END IF;
  SELECT active_revision INTO pointer FROM knowledge_documents WHERE tenant_id = t AND id = d;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF pointer IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM knowledge_document_revisions WHERE tenant_id = t AND document_id = d
      AND revision = pointer AND status = 'published' AND approved_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Active knowledge revision must be published and approved' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM knowledge_document_revisions WHERE tenant_id = t AND document_id = d AND status = 'published' AND (pointer IS NULL OR revision <> pointer)) THEN
    RAISE EXCEPTION 'Published knowledge must match active revision' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER knowledge_document_publication_consistent
  AFTER INSERT OR UPDATE OR DELETE ON knowledge_documents DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_knowledge_publication();
CREATE CONSTRAINT TRIGGER knowledge_revision_publication_consistent
  AFTER INSERT OR UPDATE OR DELETE ON knowledge_document_revisions DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_knowledge_publication();

COMMIT;
