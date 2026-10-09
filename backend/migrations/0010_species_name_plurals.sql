-- Removes the plural of the main name from the other names of an older catalogue import.
-- The page showed it as "Auch: Steinpilze". Each statement matches only the exact imported row.

DELETE FROM species_name WHERE name = 'Steinpilze' AND species_id IN (
	SELECT id FROM species WHERE slug = 'boletus-edulis' AND name = 'Steinpilz');

DELETE FROM species_name WHERE name = 'Trompetenpfifferlinge' AND species_id IN (
	SELECT id FROM species WHERE slug = 'craterellus-tubaeformis' AND name = 'Trompetenpfifferling');
