-- =========================================================
-- EXTENSIONS
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- ENUMS
-- ========================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'locale_code') THEN
        CREATE TYPE locale_code AS ENUM ('fr', 'en');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_role') THEN
        CREATE TYPE school_role AS ENUM (
            'SUPER_ADMIN',
            'SCHOOL_ADMIN',
            'TEACHER',
            'PARENT',
            'FINANCE_ADMIN'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'academic_year_status') THEN
        CREATE TYPE academic_year_status AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grading_period_type') THEN
        CREATE TYPE grading_period_type AS ENUM ('TRIMESTER');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status') THEN
        CREATE TYPE student_status AS ENUM ('ACTIVE', 'WITHDRAWN', 'GRADUATED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
        CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'TRANSFERRED', 'WITHDRAWN');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gradebook_status') THEN
        CREATE TYPE gradebook_status AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'REJECTED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_type') THEN
        CREATE TYPE assessment_type AS ENUM ('HOMEWORK', 'EXAM', 'QUIZ', 'PARTICIPATION', 'PROJECT');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_slot') THEN
        CREATE TYPE attendance_slot AS ENUM ('MORNING', 'AFTERNOON');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_session_status') THEN
        CREATE TYPE attendance_session_status AS ENUM ('DRAFT', 'SUBMITTED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audience_type') THEN
        CREATE TYPE audience_type AS ENUM ('ALL', 'TEACHERS', 'PARENTS', 'SECTION');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('ATTENDANCE_ALERT', 'GRADE_PUBLISHED', 'FEE_REMINDER', 'ANNOUNCEMENT');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
        CREATE TYPE notification_channel AS ENUM ('IN_APP', 'EMAIL');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
        CREATE TYPE notification_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fee_type') THEN
        CREATE TYPE fee_type AS ENUM ('TUITION', 'REGISTRATION', 'TRANSPORT');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_frequency') THEN
        CREATE TYPE billing_frequency AS ENUM ('MONTHLY', 'TRIMESTER', 'ONE_TIME');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type') THEN
        CREATE TYPE discount_type AS ENUM ('PERCENT', 'FIXED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_scope') THEN
        CREATE TYPE discount_scope AS ENUM ('TUITION', 'TRANSPORT', 'ALL');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE invoice_status AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
        CREATE TYPE payment_method AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'MOBILE_MONEY');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('RECORDED', 'REVERSED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
        CREATE TYPE audit_action AS ENUM (
            'CREATE', 'UPDATE', 'DELETE', 'RESTORE',
            'SUBMIT', 'APPROVE', 'PUBLISH', 'REJECT',
            'PAYMENT_RECORD', 'NOTIFICATION_SEND'
        );
    END IF;
END$$;

-- helper trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;