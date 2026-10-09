-- The glossary keeps an English definition next to the German one. Empty means no translation yet.
ALTER TABLE glossary_entry ADD COLUMN definition_en TEXT NOT NULL DEFAULT '';
