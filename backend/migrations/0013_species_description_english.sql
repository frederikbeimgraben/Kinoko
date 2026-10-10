-- The species keeps an English description next to the German one. Empty means no translation yet.
ALTER TABLE species ADD COLUMN description_en TEXT NOT NULL DEFAULT '';
-- True when the description is a draft that nobody has reviewed.
ALTER TABLE species ADD COLUMN description_draft BOOLEAN NOT NULL DEFAULT FALSE;
