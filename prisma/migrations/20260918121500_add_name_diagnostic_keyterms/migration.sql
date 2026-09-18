UPDATE "Settings"
SET "keyterms" = trim("keyterms") || char(10) || 'Ghufran Ahmad Khan'
WHERE instr(char(10) || lower("keyterms") || char(10), char(10) || lower('Ghufran Ahmad Khan') || char(10)) = 0;

UPDATE "Settings"
SET "keyterms" = trim("keyterms") || char(10) || 'Ghufran'
WHERE instr(char(10) || lower("keyterms") || char(10), char(10) || lower('Ghufran') || char(10)) = 0;

UPDATE "Settings"
SET "keyterms" = trim("keyterms") || char(10) || 'Ahmad'
WHERE instr(char(10) || lower("keyterms") || char(10), char(10) || lower('Ahmad') || char(10)) = 0;

UPDATE "Settings"
SET "keyterms" = trim("keyterms") || char(10) || 'Khan'
WHERE instr(char(10) || lower("keyterms") || char(10), char(10) || lower('Khan') || char(10)) = 0;
