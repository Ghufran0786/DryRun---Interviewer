UPDATE "Settings"
SET "keyterms" = trim("candidateName") || char(10) || "keyterms"
WHERE trim("candidateName") <> ''
  AND instr(lower("keyterms"), lower(trim("candidateName"))) = 0;
