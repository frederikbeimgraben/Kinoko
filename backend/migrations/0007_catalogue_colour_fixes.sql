-- Corrects colours of an older catalogue import. That import kept colours that the trait text denies
-- ("nicht blauend", "keine Rottöne"), names as rare, or only uses in a comparison or for cooking.
-- It also read the colour of a reagent from a side note ("mit graugrüner Schattierung").
-- Each statement matches only the exact imported row, so a row that an editor changed stays.

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'auricularia-mesenterica' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.to_hex = '#3a5f9e' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'boletus-edulis' AND c.part = 'flesh' AND c.to_name = 'grün' AND c.to_hex = '#4f8a3a' AND c.from_name IS NULL AND t.slug = 'melzer');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'bondarzewia-mesenterica' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.to_hex = '#3a5f9e' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'butyriboletus-subappendiculatus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.to_hex = '#3a5f9e' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'grifola-frondosa' AND c.part = 'flesh' AND c.to_name = 'schwarz' AND c.to_hex = '#1a1a1a' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'imleria-badia' AND c.part = 'cap' AND c.to_name = 'blaugrün' AND c.to_hex = '#2f7f7a' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'leccinum-aurantiacum' AND c.part = 'flesh' AND c.to_name = 'schwarz' AND c.to_hex = '#1a1a1a' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'leccinum-vulpinum' AND c.part = 'flesh' AND c.to_name = 'schwarz' AND c.to_hex = '#1a1a1a' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'pleurotus-djamor' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.to_hex = '#3a5f9e' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-aeruginea' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.to_hex = '#3a5f9e' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'sarcoscypha-jurana' AND c.part = 'flesh' AND c.to_name = 'grün' AND c.to_hex = '#4f8a3a' AND c.from_name IS NULL AND t.slug = 'melzer');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-bovinus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.to_hex = '#3a5f9e' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-grevillei' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.to_hex = '#3a5f9e' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-placidus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.to_hex = '#3a5f9e' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'tylopilus-felleus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.to_hex = '#3a5f9e' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomus-subtomentosus' AND c.part = 'cap' AND c.to_name = 'blaugrün' AND c.to_hex = '#2f7f7a' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change_trigger WHERE NOT EXISTS (
	SELECT 1 FROM species_colour_change c
	WHERE c.species_id = species_colour_change_trigger.species_id AND c.position = species_colour_change_trigger.position);

-- The reagent melzer of boletus-edulis gets the colour of its main reading.
INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'ocker', '#c8963c'
	FROM species s WHERE s.slug = 'boletus-edulis' AND NOT EXISTS (
		SELECT 1 FROM species_colour_change c JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id WHERE c.species_id = s.id AND c.part = 'flesh' AND t.slug = 'melzer')
	AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'melzer');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, c.position, t.id FROM species s
	JOIN species_colour_change c ON c.species_id = s.id AND c.part = 'flesh' AND c.to_name = 'ocker' AND c.from_name IS NULL
	JOIN term t ON t.kind = 'trigger' AND t.slug = 'melzer'
	WHERE s.slug = 'boletus-edulis' AND NOT EXISTS (
		SELECT 1 FROM species_colour_change_trigger x WHERE x.species_id = c.species_id AND x.position = c.position);

-- The reagent ammonia of imleria-badia gets the colour of its main reading.
INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'schwarz', '#1a1a1a'
	FROM species s WHERE s.slug = 'imleria-badia' AND NOT EXISTS (
		SELECT 1 FROM species_colour_change c JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id WHERE c.species_id = s.id AND c.part = 'cap' AND t.slug = 'ammonia')
	AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'ammonia');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, c.position, t.id FROM species s
	JOIN species_colour_change c ON c.species_id = s.id AND c.part = 'cap' AND c.to_name = 'schwarz' AND c.from_name IS NULL
	JOIN term t ON t.kind = 'trigger' AND t.slug = 'ammonia'
	WHERE s.slug = 'imleria-badia' AND NOT EXISTS (
		SELECT 1 FROM species_colour_change_trigger x WHERE x.species_id = c.species_id AND x.position = c.position);

-- The reagent melzer of sarcoscypha-jurana gets the colour of its main reading.
INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'blau', '#3a5f9e'
	FROM species s WHERE s.slug = 'sarcoscypha-jurana' AND NOT EXISTS (
		SELECT 1 FROM species_colour_change c JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id WHERE c.species_id = s.id AND c.part = 'flesh' AND t.slug = 'melzer')
	AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'melzer');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, c.position, t.id FROM species s
	JOIN species_colour_change c ON c.species_id = s.id AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL
	JOIN term t ON t.kind = 'trigger' AND t.slug = 'melzer'
	WHERE s.slug = 'sarcoscypha-jurana' AND NOT EXISTS (
		SELECT 1 FROM species_colour_change_trigger x WHERE x.species_id = c.species_id AND x.position = c.position);

-- The reagent ammonia of xerocomus-subtomentosus gets the colour of its main reading.
INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'rot', '#c0392b'
	FROM species s WHERE s.slug = 'xerocomus-subtomentosus' AND NOT EXISTS (
		SELECT 1 FROM species_colour_change c JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id WHERE c.species_id = s.id AND c.part = 'cap' AND t.slug = 'ammonia')
	AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'ammonia');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, c.position, t.id FROM species s
	JOIN species_colour_change c ON c.species_id = s.id AND c.part = 'cap' AND c.to_name = 'rot' AND c.from_name IS NULL
	JOIN term t ON t.kind = 'trigger' AND t.slug = 'ammonia'
	WHERE s.slug = 'xerocomus-subtomentosus' AND NOT EXISTS (
		SELECT 1 FROM species_colour_change_trigger x WHERE x.species_id = c.species_id AND x.position = c.position);

DELETE FROM species_colour WHERE part = 'flesh' AND name = 'rot' AND hex = '#c0392b'
	AND species_id = (SELECT id FROM species WHERE slug = 'amanita-spissa');
DELETE FROM species_colour WHERE part = 'cap' AND name = 'rot' AND hex = '#c0392b'
	AND species_id = (SELECT id FROM species WHERE slug = 'amanita-virosa');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'aureoboletus-gentilis');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-aereus');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-aereus');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'rot' AND hex = '#c0392b'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-edulis');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-fulvomaculatus');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-fulvomaculatus');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'rot' AND hex = '#c0392b'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-pinophilus');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'rot' AND hex = '#c0392b'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-reticulatus');
DELETE FROM species_colour WHERE part = 'cap' AND name = 'violett' AND hex = '#6b4a8a'
	AND species_id = (SELECT id FROM species WHERE slug = 'butyriboletus-fechtneri');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'butyriboletus-subappendiculatus');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'butyriboletus-subappendiculatus');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'rotbraun' AND hex = '#8b4a2b'
	AND species_id = (SELECT id FROM species WHERE slug = 'entoloma-clypeatum');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'rot' AND hex = '#c0392b'
	AND species_id = (SELECT id FROM species WHERE slug = 'lactarius-rufus');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'schwarz' AND hex = '#1a1a1a'
	AND species_id = (SELECT id FROM species WHERE slug = 'leccinum-variicolor');
DELETE FROM species_colour WHERE part = 'stem' AND name = 'schwarz' AND hex = '#1a1a1a'
	AND species_id = (SELECT id FROM species WHERE slug = 'polyporus-tuberaster');
DELETE FROM species_colour WHERE part = 'cap' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'rubroboletus-satanas');
DELETE FROM species_colour WHERE part = 'stem' AND name = 'rot' AND hex = '#c0392b'
	AND species_id = (SELECT id FROM species WHERE slug = 'russula-silvestris');
DELETE FROM species_colour WHERE part = 'cap' AND name = 'violett' AND hex = '#6b4a8a'
	AND species_id = (SELECT id FROM species WHERE slug = 'russula-virescens');
DELETE FROM species_colour WHERE part = 'cap' AND name = 'rot' AND hex = '#c0392b'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillellus-luridus');
DELETE FROM species_colour WHERE part = 'cap' AND name = 'oliv' AND hex = '#6b7a3a'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillellus-queletii');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillus-bovinus');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillus-grevillei');
DELETE FROM species_colour WHERE part = 'flesh' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'tylopilus-felleus');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'xerocomellus-pruinatus');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'flesh' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'amanita-spissa')
	AND (SELECT count(*) FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = 'flesh') = 1;
UPDATE species_colour_range SET mode = 'single' WHERE part = 'cap' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'amanita-virosa')
	AND (SELECT count(*) FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = 'cap') = 1;
UPDATE species_colour_range SET mode = 'single' WHERE part = 'flesh' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-aereus')
	AND (SELECT count(*) FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = 'flesh') = 1;
UPDATE species_colour_range SET mode = 'single' WHERE part = 'flesh' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-edulis')
	AND (SELECT count(*) FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = 'flesh') = 1;
UPDATE species_colour_range SET mode = 'single' WHERE part = 'flesh' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-fulvomaculatus')
	AND (SELECT count(*) FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = 'flesh') = 1;
UPDATE species_colour_range SET mode = 'single' WHERE part = 'flesh' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-pinophilus')
	AND (SELECT count(*) FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = 'flesh') = 1;
UPDATE species_colour_range SET mode = 'single' WHERE part = 'flesh' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'boletus-reticulatus')
	AND (SELECT count(*) FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = 'flesh') = 1;
UPDATE species_colour_range SET mode = 'single' WHERE part = 'flesh' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'lactarius-rufus')
	AND (SELECT count(*) FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = 'flesh') = 1;
UPDATE species_colour_range SET mode = 'single' WHERE part = 'flesh' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillus-bovinus')
	AND (SELECT count(*) FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = 'flesh') = 1;

-- The profile source has the name of the site as its title. The host name shows below it.
UPDATE species_source SET title = '123pilzsuche' WHERE scope = 'profile' AND title = '123pilzsuche.de';
