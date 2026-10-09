-- The glossary keeps an English term next to the German one. Empty means no translation yet.
ALTER TABLE glossary_entry ADD COLUMN term_en TEXT NOT NULL DEFAULT '';

-- The terms that the seed daten/glossar.json added one time. The seed does not add a deleted term again.
CREATE TABLE glossary_seed (
	term VARCHAR(120) NOT NULL,
	PRIMARY KEY (term)
);
