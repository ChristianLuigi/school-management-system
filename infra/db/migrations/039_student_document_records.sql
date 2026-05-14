CREATE TABLE IF NOT EXISTS student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  student_id UUID NOT NULL REFERENCES students(id),
  document_type TEXT NOT NULL,
  document_status TEXT NOT NULL DEFAULT 'PENDING',
  file_name TEXT,
  file_url TEXT,
  received_at DATE,
  verified_at TIMESTAMPTZ,
  uploaded_by_user_id UUID REFERENCES users(id),
  verified_by_user_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_student_documents_student
  ON student_documents(student_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_documents_school_type
  ON student_documents(school_id, document_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_documents_status
  ON student_documents(school_id, document_status)
  WHERE deleted_at IS NULL;
