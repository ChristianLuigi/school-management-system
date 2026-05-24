ALTER TABLE sections
ADD COLUMN IF NOT EXISTS capacity INT;

ALTER TABLE sections
ADD COLUMN IF NOT EXISTS room_label TEXT;

CREATE OR REPLACE FUNCTION section_letter_from_number(p_number INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_letters TEXT := '';
  v_number INT := p_number;
  v_remainder INT;
BEGIN
  WHILE v_number > 0 LOOP
    v_remainder := (v_number - 1) % 26;
    v_letters := CHR(65 + v_remainder) || v_letters;
    v_number := (v_number - 1) / 26;
  END LOOP;

  RETURN v_letters;
END;
$$;
