CREATE OR REPLACE VIEW v_section_subject_grading_resolution AS
SELECT
    ss.id AS section_subject_id,
    ss.school_id,
    ss.section_id,
    ss.subject_id,
    ss.teacher_id,
    ss.coefficient,
    COALESCE(ss_gc.id, gl_gc.id, school_gc.id) AS resolved_grading_configuration_id,
    COALESCE(ss_gc.max_score, gl_gc.max_score, school_gc.max_score) AS resolved_max_score,
    COALESCE(ss_gc.passing_score, gl_gc.passing_score, school_gc.passing_score) AS resolved_passing_score,
    COALESCE(ss_gc.rounding_precision, gl_gc.rounding_precision, school_gc.rounding_precision) AS rounding_precision,
    COALESCE(ss_gc.rounding_mode, gl_gc.rounding_mode, school_gc.rounding_mode) AS rounding_mode
FROM section_subjects ss
JOIN sections sec ON sec.id = ss.section_id
JOIN grade_levels gl ON gl.id = sec.grade_level_id
LEFT JOIN grading_configurations ss_gc
    ON ss_gc.id = ss.grading_configuration_id
   AND ss_gc.deleted_at IS NULL
LEFT JOIN grading_configurations gl_gc
    ON gl_gc.id = gl.grading_configuration_id
   AND gl_gc.deleted_at IS NULL
LEFT JOIN grading_configurations school_gc
    ON school_gc.school_id = ss.school_id
   AND school_gc.is_default = TRUE
   AND school_gc.deleted_at IS NULL
WHERE ss.deleted_at IS NULL
  AND sec.deleted_at IS NULL
  AND gl.deleted_at IS NULL;


CREATE OR REPLACE VIEW v_student_subject_term_averages AS
SELECT
    gb.id AS gradebook_id,
    gb.grading_period_id,
    ss.id AS section_subject_id,
    e.student_id,
    r.resolved_max_score,
    r.resolved_passing_score,
    ss.coefficient,

    ROUND(
        SUM(
            ((sc.raw_score / a.max_points_possible) * r.resolved_max_score) * (a.weight_percent / 100.0)
        ),
        2
    ) AS subject_average

FROM gradebooks gb
JOIN section_subjects ss
    ON ss.id = gb.section_subject_id
JOIN v_section_subject_grading_resolution r
    ON r.section_subject_id = ss.id
JOIN sections sec
    ON sec.id = ss.section_id
JOIN enrollments e
    ON e.section_id = sec.id
   AND e.enrollment_status = 'ACTIVE'
   AND e.deleted_at IS NULL
JOIN assessments a
    ON a.gradebook_id = gb.id
   AND a.deleted_at IS NULL
JOIN assessment_scores sc
    ON sc.assessment_id = a.id
   AND sc.student_id = e.student_id
   AND sc.deleted_at IS NULL
WHERE gb.deleted_at IS NULL
  AND ss.deleted_at IS NULL
  AND sec.deleted_at IS NULL
GROUP BY
    gb.id,
    gb.grading_period_id,
    ss.id,
    e.student_id,
    r.resolved_max_score,
    r.resolved_passing_score,
    ss.coefficient;

CREATE OR REPLACE VIEW v_student_trimester_averages AS
SELECT
    grading_period_id,
    student_id,
    ROUND(
        SUM(subject_average * coefficient) / NULLIF(SUM(coefficient), 0),
        2
    ) AS trimester_average
FROM v_student_subject_term_averages
GROUP BY grading_period_id, student_id;

CREATE OR REPLACE VIEW v_student_trimester_ranks AS
SELECT
    x.grading_period_id,
    x.section_id,
    x.student_id,
    x.trimester_average,
    DENSE_RANK() OVER (
        PARTITION BY x.grading_period_id, x.section_id
        ORDER BY x.trimester_average DESC
    ) AS rank_in_section
FROM (
    SELECT
        gb.grading_period_id,
        ss.section_id,
        vsta.student_id,
        ROUND(
            SUM(vsta.subject_average * vsta.coefficient) / NULLIF(SUM(vsta.coefficient), 0),
            2
        ) AS trimester_average
    FROM v_student_subject_term_averages vsta
    JOIN gradebooks gb ON gb.id = vsta.gradebook_id
    JOIN section_subjects ss ON ss.id = vsta.section_subject_id
    GROUP BY gb.grading_period_id, ss.section_id, vsta.student_id
) x;

CREATE OR REPLACE VIEW v_student_attendance_summary AS
SELECT
    ar.student_id,
    gp.id AS grading_period_id,
    COUNT(*) FILTER (WHERE ar.status = 'PRESENT') AS present_count,
    COUNT(*) FILTER (WHERE ar.status = 'ABSENT') AS absent_count,
    COUNT(*) FILTER (WHERE ar.status = 'LATE') AS late_count,
    COUNT(*) FILTER (WHERE ar.status = 'EXCUSED') AS excused_count
FROM attendance_records ar
JOIN attendance_sessions s
    ON s.id = ar.attendance_session_id
JOIN sections sec
    ON sec.id = s.section_id
JOIN grading_periods gp
    ON s.attendance_date BETWEEN gp.start_date AND gp.end_date
WHERE ar.deleted_at IS NULL
  AND s.deleted_at IS NULL
  AND sec.deleted_at IS NULL
GROUP BY ar.student_id, gp.id;

