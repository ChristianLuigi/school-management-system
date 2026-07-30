BEGIN;

CREATE TABLE IF NOT EXISTS staff_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  staff_account_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'IDENTITY',
      'CONTRACT',
      'CERTIFICATION',
      'LICENSE',
      'BACKGROUND_CHECK',
      'WORK_PERMIT',
      'OTHER'
    )
  ),
  display_name TEXT NOT NULL CHECK (BTRIM(display_name) <> ''),
  storage_key TEXT NOT NULL CHECK (BTRIM(storage_key) <> ''),
  original_file_name TEXT NOT NULL CHECK (BTRIM(original_file_name) <> ''),
  mime_type TEXT NOT NULL CHECK (
    mime_type IN (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    )
  ),
  file_size_bytes BIGINT NOT NULL CHECK (
    file_size_bytes > 0
    AND file_size_bytes <= 10485760
  ),
  issued_on DATE,
  expires_on DATE,
  confidentiality TEXT NOT NULL DEFAULT 'STANDARD' CHECK (
    confidentiality IN ('STANDARD', 'RESTRICTED')
  ),
  document_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (
    document_status IN ('ACTIVE', 'REVOKED')
  ),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
  revoked_by_user_id UUID REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_staff_document_school
    FOREIGN KEY (staff_account_id, school_id)
    REFERENCES school_staff_accounts(id, school_id),
  CONSTRAINT staff_document_date_order_check
    CHECK (
      issued_on IS NULL
      OR expires_on IS NULL
      OR expires_on >= issued_on
    ),
  CONSTRAINT staff_document_revocation_check
    CHECK (
      (
        document_status = 'ACTIVE'
        AND revoked_at IS NULL
        AND revoked_by_user_id IS NULL
        AND revocation_reason IS NULL
      )
      OR (
        document_status = 'REVOKED'
        AND revoked_at IS NOT NULL
        AND revoked_by_user_id IS NOT NULL
        AND NULLIF(BTRIM(revocation_reason), '') IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_document_storage_key
  ON staff_documents(storage_key);

CREATE INDEX IF NOT EXISTS idx_staff_documents_record
  ON staff_documents(school_id, staff_account_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_documents_expiry
  ON staff_documents(school_id, expires_on)
  WHERE deleted_at IS NULL
    AND document_status = 'ACTIVE'
    AND expires_on IS NOT NULL;

CREATE TABLE IF NOT EXISTS staff_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  staff_account_id UUID NOT NULL,
  leave_type TEXT NOT NULL CHECK (
    leave_type IN (
      'ANNUAL',
      'SICK',
      'MATERNITY',
      'PATERNITY',
      'BEREAVEMENT',
      'UNPAID',
      'OTHER'
    )
  ),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  requested_days NUMERIC(6, 2) NOT NULL CHECK (requested_days > 0),
  request_reason TEXT NOT NULL CHECK (BTRIM(request_reason) <> ''),
  request_status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (
    request_status IN (
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'CANCELLED'
    )
  ),
  requested_by_user_id UUID NOT NULL REFERENCES users(id),
  reviewed_by_user_id UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_staff_leave_request_school
    FOREIGN KEY (staff_account_id, school_id)
    REFERENCES school_staff_accounts(id, school_id),
  CONSTRAINT staff_leave_date_order_check
    CHECK (end_date >= start_date),
  CONSTRAINT staff_leave_review_check
    CHECK (
      (
        request_status = 'SUBMITTED'
        AND reviewed_by_user_id IS NULL
        AND reviewed_at IS NULL
        AND review_note IS NULL
      )
      OR (
        request_status = 'APPROVED'
        AND reviewed_by_user_id IS NOT NULL
        AND reviewed_at IS NOT NULL
      )
      OR (
        request_status = 'REJECTED'
        AND reviewed_by_user_id IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND NULLIF(BTRIM(review_note), '') IS NOT NULL
      )
      OR request_status = 'CANCELLED'
    )
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_record
  ON staff_leave_requests(
    school_id,
    staff_account_id,
    start_date DESC
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_queue
  ON staff_leave_requests(school_id, request_status, start_date)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS staff_leave_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  leave_request_id UUID NOT NULL REFERENCES staff_leave_requests(id),
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'CANCELLED'
    )
  ),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_events_history
  ON staff_leave_request_events(
    school_id,
    leave_request_id,
    created_at
  );

CREATE OR REPLACE FUNCTION touch_staff_document()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.display_name := BTRIM(NEW.display_name);
  NEW.storage_key := BTRIM(NEW.storage_key);
  NEW.original_file_name := BTRIM(NEW.original_file_name);
  NEW.revocation_reason := NULLIF(BTRIM(NEW.revocation_reason), '');
  IF TG_OP = 'UPDATE' THEN
    NEW.row_version := OLD.row_version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_staff_document ON staff_documents;

CREATE TRIGGER trg_touch_staff_document
BEFORE INSERT OR UPDATE
ON staff_documents
FOR EACH ROW
EXECUTE FUNCTION touch_staff_document();

CREATE OR REPLACE FUNCTION guard_staff_leave_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  overlap_id UUID;
BEGIN
  NEW.request_reason := BTRIM(NEW.request_reason);
  NEW.review_note := NULLIF(BTRIM(NEW.review_note), '');

  IF TG_OP = 'INSERT' AND NEW.request_status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'A leave request must begin as SUBMITTED.'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.request_status <> OLD.request_status THEN
    IF NOT (
      (
        OLD.request_status = 'SUBMITTED'
        AND NEW.request_status IN ('APPROVED', 'REJECTED', 'CANCELLED')
      )
      OR (
        OLD.request_status = 'APPROVED'
        AND NEW.request_status = 'CANCELLED'
      )
    ) THEN
      RAISE EXCEPTION 'Invalid staff leave request transition: % -> %.',
        OLD.request_status,
        NEW.request_status
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.request_status IN ('SUBMITTED', 'APPROVED') THEN
    SELECT request.id
    INTO overlap_id
    FROM staff_leave_requests request
    WHERE request.school_id = NEW.school_id
      AND request.staff_account_id = NEW.staff_account_id
      AND request.deleted_at IS NULL
      AND request.request_status IN ('SUBMITTED', 'APPROVED')
      AND request.id <> NEW.id
      AND daterange(
        request.start_date,
        request.end_date,
        '[]'
      ) && daterange(NEW.start_date, NEW.end_date, '[]')
    LIMIT 1;

    IF overlap_id IS NOT NULL THEN
      RAISE EXCEPTION 'The leave request overlaps another active request.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.row_version := OLD.row_version + 1;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_staff_leave_request
  ON staff_leave_requests;

CREATE TRIGGER trg_guard_staff_leave_request
BEFORE INSERT OR UPDATE
ON staff_leave_requests
FOR EACH ROW
EXECUTE FUNCTION guard_staff_leave_request();

CREATE OR REPLACE FUNCTION prevent_staff_leave_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Staff leave history is append-only.'
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_leave_events_append_only
  ON staff_leave_request_events;

CREATE TRIGGER trg_staff_leave_events_append_only
BEFORE UPDATE OR DELETE
ON staff_leave_request_events
FOR EACH ROW
EXECUTE FUNCTION prevent_staff_leave_event_mutation();

COMMIT;
