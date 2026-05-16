ALTER TABLE grade_levels
ADD COLUMN IF NOT EXISTS academic_division TEXT;

ALTER TABLE grade_levels
ADD COLUMN IF NOT EXISTS display_order INT;

ALTER TABLE sections
ADD COLUMN IF NOT EXISTS display_order INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_grade_levels_academic_division'
  ) THEN
    ALTER TABLE grade_levels
    ADD CONSTRAINT chk_grade_levels_academic_division
    CHECK (
      academic_division IS NULL OR academic_division IN (
        'KINDERGARTEN',
        'PRIMARY',
        'SECONDARY'
      )
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION ensure_haitian_academic_structure(p_school_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  v_academic_year_id UUID;
  v_year INT;
  v_grade_level_id UUID;
  v_section_id UUID;
BEGIN
  SELECT id
  INTO v_academic_year_id
  FROM academic_years
  WHERE school_id = p_school_id
    AND deleted_at IS NULL
  ORDER BY
    CASE status
      WHEN 'ACTIVE' THEN 1
      WHEN 'PLANNED' THEN 2
      ELSE 3
    END,
    start_date DESC
  LIMIT 1;

  IF v_academic_year_id IS NULL THEN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

    INSERT INTO academic_years (
      school_id,
      name_i18n,
      start_date,
      end_date,
      status
    )
    VALUES (
      p_school_id,
      jsonb_build_object(
        'fr', v_year::TEXT || '-' || (v_year + 1)::TEXT,
        'en', v_year::TEXT || '-' || (v_year + 1)::TEXT
      ),
      make_date(v_year, 9, 1),
      make_date(v_year + 1, 7, 31),
      'ACTIVE'
    )
    RETURNING id INTO v_academic_year_id;
  END IF;

  FOR rec IN
    SELECT *
    FROM (
      VALUES
        ('KG1', 'Maternelle 1', 'Kindergarten 1', 'KINDERGARTEN', 10),
        ('KG2', 'Maternelle 2', 'Kindergarten 2', 'KINDERGARTEN', 20),
        ('KG3', 'Maternelle 3', 'Kindergarten 3', 'KINDERGARTEN', 30),

        ('G1', '1re Annee', '1st Grade', 'PRIMARY', 110),
        ('G2', '2e Annee', '2nd Grade', 'PRIMARY', 120),
        ('G3', '3e Annee', '3rd Grade', 'PRIMARY', 130),
        ('G4', '4e Annee', '4th Grade', 'PRIMARY', 140),
        ('G5', '5e Annee', '5th Grade', 'PRIMARY', 150),
        ('G6', '6e Annee', '6th Grade', 'PRIMARY', 160),

        ('G7', '7e Annee', '7th Grade', 'SECONDARY', 210),
        ('G8', '8e Annee', '8th Grade', 'SECONDARY', 220),
        ('G9', '9e Annee', '9th Grade', 'SECONDARY', 230),
        ('NS1', 'NS1', 'NS1', 'SECONDARY', 240),
        ('NS2', 'NS2', 'NS2', 'SECONDARY', 250),
        ('NS3', 'NS3', 'NS3', 'SECONDARY', 260),
        ('NS4', 'NS4', 'NS4', 'SECONDARY', 270)
    ) AS defaults(code, name_fr, name_en, division, order_no)
  LOOP
    SELECT id
    INTO v_grade_level_id
    FROM grade_levels
    WHERE school_id = p_school_id
      AND code = rec.code
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_grade_level_id IS NULL THEN
      INSERT INTO grade_levels (
        school_id,
        code,
        name_i18n,
        academic_division,
        display_order
      )
      VALUES (
        p_school_id,
        rec.code,
        jsonb_build_object(
          'fr', rec.name_fr,
          'en', rec.name_en
        ),
        rec.division,
        rec.order_no
      )
      RETURNING id INTO v_grade_level_id;
    ELSE
      UPDATE grade_levels
      SET
        name_i18n = COALESCE(name_i18n, '{}'::jsonb)
          || jsonb_build_object('fr', rec.name_fr, 'en', rec.name_en),
        academic_division = rec.division,
        display_order = rec.order_no,
        updated_at = NOW()
      WHERE id = v_grade_level_id;
    END IF;

    SELECT id
    INTO v_section_id
    FROM sections
    WHERE school_id = p_school_id
      AND academic_year_id = v_academic_year_id
      AND grade_level_id = v_grade_level_id
      AND code = rec.code || '-A'
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_section_id IS NULL THEN
      INSERT INTO sections (
        school_id,
        academic_year_id,
        grade_level_id,
        code,
        name_i18n,
        display_order
      )
      VALUES (
        p_school_id,
        v_academic_year_id,
        v_grade_level_id,
        rec.code || '-A',
        jsonb_build_object(
          'fr', rec.name_fr || ' - Section A',
          'en', rec.name_en || ' - Section A'
        ),
        1
      );
    ELSE
      UPDATE sections
      SET
        name_i18n = COALESCE(name_i18n, '{}'::jsonb)
          || jsonb_build_object(
            'fr', rec.name_fr || ' - Section A',
            'en', rec.name_en || ' - Section A'
          ),
        display_order = 1,
        updated_at = NOW()
      WHERE id = v_section_id;
    END IF;

    v_grade_level_id := NULL;
    v_section_id := NULL;
  END LOOP;
END;
$$;
