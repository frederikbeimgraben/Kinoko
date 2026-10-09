-- The photo keeps an English caption next to the German one. Empty means no translation yet.
ALTER TABLE photo ADD COLUMN caption_en TEXT NOT NULL DEFAULT '';
