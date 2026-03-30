-- =========================================================
-- RAW SCORE MUST NOT EXCEED ASSESSMENT MAX
-- =========================================================
CREATE OR REPLACE FUNCTION validate_assessment_score()
RETURNS TRIGGER AS $$
DECLARE
    v_max NUMERIC(8,2);
BEGIN
    SELECT max_points_possible
    INTO v_max
    FROM assessments
    WHERE id = NEW.assessment_id
      AND deleted_at IS NULL;

    IF v_max IS NULL THEN
        RAISE EXCEPTION 'Assessment % not found or deleted', NEW.assessment_id;
    END IF;

    IF NEW.raw_score > v_max THEN
        RAISE EXCEPTION 'Raw score % exceeds max points % for assessment %',
            NEW.raw_score, v_max, NEW.assessment_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_assessment_score
BEFORE INSERT OR UPDATE ON assessment_scores
FOR EACH ROW EXECUTE FUNCTION validate_assessment_score();

-- =========================================================
-- VALIDATE GRADEBOOK CAN BE SUBMITTED
-- =========================================================
CREATE OR REPLACE FUNCTION validate_gradebook_submission(p_gradebook_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_weight NUMERIC(8,2);
    v_missing_scores_count INTEGER;
BEGIN
    SELECT COALESCE(SUM(weight_percent), 0)
    INTO v_total_weight
    FROM assessments
    WHERE gradebook_id = p_gradebook_id
      AND deleted_at IS NULL;

    IF v_total_weight <> 100 THEN
        RAISE EXCEPTION 'Gradebook % cannot be submitted: assessment weights total %, expected 100',
            p_gradebook_id, v_total_weight;
    END IF;

    -- Optional strict completeness check:
    -- every active enrolled student should have a score for every active assessment
    SELECT COUNT(*)
    INTO v_missing_scores_count
    FROM assessments a
    JOIN gradebooks gb ON gb.id = a.gradebook_id
    JOIN section_subjects ss ON ss.id = gb.section_subject_id
    JOIN enrollments e ON e.section_id = ss.section_id
    LEFT JOIN assessment_scores s
      ON s.assessment_id = a.id
     AND s.student_id = e.student_id
     AND s.deleted_at IS NULL
    WHERE a.gradebook_id = p_gradebook_id
      AND a.deleted_at IS NULL
      AND e.enrollment_status = 'ACTIVE'
      AND e.deleted_at IS NULL
      AND s.id IS NULL;

    IF v_missing_scores_count > 0 THEN
        RAISE EXCEPTION 'Gradebook % cannot be submitted: % missing scores',
            p_gradebook_id, v_missing_scores_count;
    END IF;
END;
$$ LANGUAGE plpgsql;