-- Corrects the colour changes of an older catalogue import. That import read a colour from
-- negated reagent texts, put each reagent on the flesh and kept a cut change that the trait text denies.
-- Each statement matches only the exact imported row, so a row that an editor changed stays.

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'agaricus-arvensis' AND c.part = 'flesh' AND c.to_name = 'purpurrot' AND c.from_name IS NULL AND t.slug = 'schaeffer');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'agaricus-pseudopratensis' AND c.part = 'flesh' AND c.to_name = 'braun' AND c.from_name IS NULL AND t.slug = 'schaeffer');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'albatrellus-citrinus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'albatrellus-citrinus' AND c.part = 'flesh' AND c.to_name = 'rot' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'albatrellus-cristatus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'albatrellus-cristatus' AND c.part = 'flesh' AND c.to_name = 'orange' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'amanita-contui' AND c.part = 'flesh' AND c.to_name = 'weinrot' AND c.from_name IS NULL AND t.slug = 'phenol');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'amanita-franchetii' AND c.part = 'flesh' AND c.to_name = 'rot' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'amanita-fulva' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'guaiac');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'amanita-phalloides' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'amanita-phalloides' AND c.part = 'flesh' AND c.to_name = 'gelb' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'amanita-phalloides-var-alba' AND c.part = 'flesh' AND c.to_name = 'gelb' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'amanita-spissa' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'aphroditeola-olida' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'armillaria-gallica' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'armillaria-mellea' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'armillaria-ostoyae' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'atractosporocybe-inornata' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'aureoboletus-gentilis' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'boletus-aereus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'boletus-fulvomaculatus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'bondarzewia-mesenterica' AND c.part = 'flesh' AND c.to_name = 'gelb' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'butyriboletus-subappendiculatus' AND c.part = 'flesh' AND c.to_name = 'braun' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'calocybe-gambosa' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'calocybe-graveolens' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'cerioporus-leptocephalus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'cerioporus-leptocephalus' AND c.part = 'flesh' AND c.to_name = 'rosa' AND c.from_name IS NULL AND t.slug = 'naoh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'cerioporus-squamosus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'chroogomphus-fulmineus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'chroogomphus-helveticus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'chroogomphus-rutilus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'chrysomphalina-grossula' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'clitocybe-ditopa' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'clitocybe-maxima' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'clitocybe-nebularis' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'clitocybe-obsoleta' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'clitocybe-phyllophila' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'clitocybe-rivulosa' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'clitopilus-prunulus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'cortinarius-limonius' AND c.part = 'flesh' AND c.to_name = 'blutrot' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'cortinarius-meinhardii' AND c.part = 'flesh' AND c.to_name = 'rotbraun' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'cortinarius-rubellus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'cortinarius-rubellus' AND c.part = 'flesh' AND c.to_name = 'schwarz' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'desarmillaria-tabescens' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'entoloma-lividoalbum' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'entoloma-sepium' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'guaiac');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'entoloma-sinuatum' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'faerberia-carbonaria' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'galerina-marginata' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'galerina-marginata' AND c.part = 'flesh' AND c.to_name = 'rot' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'gomphidius-roseus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'gymnopilus-penetrans' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'gymnopilus-picreus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'gymnopilus-sapineus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hygrocybe-turunda' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hygrophoropsis-aurantiaca' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hygrophoropsis-rufa' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hygrophorus-gliocyclus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hygrophorus-inocybiformis' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hygrophorus-latitabundus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hygrophorus-marzuolus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hygrophorus-mesotephrus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hygrophorus-mesotephrus' AND c.part = 'flesh' AND c.to_name = 'orangegelb' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'hypholoma-capnoides' AND c.part = 'flesh' AND c.to_name = 'rot' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'imleria-badia' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'melzer');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'imleria-badia' AND c.part = 'flesh' AND c.to_name = 'blaugrün' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'imleria-badia' AND c.part = 'flesh' AND c.to_name = 'oliv' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'imleria-badia' AND c.part = 'flesh' AND c.to_name = 'orange' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'infundibulicybe-geotropa' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'infundibulicybe-geotropa' AND c.part = 'flesh' AND c.to_name = 'olivgrün' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'infundibulicybe-gibba' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'inocybe-hystrix' AND c.part = 'flesh' AND c.to_name = 'grau' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'jahnoporus-hirtus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'kuehneromyces-mutabilis' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lactarius-deterrimus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lactarius-helvus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lactarius-hysginus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lactarius-quietus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lactarius-volemus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lactifluus-rugatus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'leccinum-aurantiacum' AND c.part = 'flesh' AND c.to_name = 'violett' AND c.from_name IS NULL AND t.slug = 'formalin');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'leccinum-scabrum' AND c.part = 'flesh' AND c.to_name = 'rot' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lepista-flaccida' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lepista-flaccida' AND c.part = 'flesh' AND c.to_name = 'orange' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lepista-panaeolus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'leucoagaricus-leucothites' AND c.part = 'flesh' AND c.to_name = 'gelb' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'leucopaxillus-giganteus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'lyophyllum-decastes' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'macrolepiota-mastoidea' AND c.part = 'flesh' AND c.to_name = 'rot' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'melanoleuca-grammopodia' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'meripilus-giganteus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'mucidula-mucida' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'neolentinus-cyathiformis' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'neolentinus-lepideus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'omphalotus-olearius' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'omphalotus-olearius' AND c.part = 'flesh' AND c.to_name = 'grün' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'omphalotus-olearius' AND c.part = 'flesh' AND c.to_name = 'grün' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'osteina-obducta' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'panellus-serotinus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'pholiota-lignicola' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'pholiota-spumosa' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'pholiota-squarrosoides' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'pleurotus-cornucopiae' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'pleurotus-dryinus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'pleurotus-ostreatus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'pleurotus-pulmonarius' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'pleurotus-pulmonarius' AND c.part = 'flesh' AND c.to_name = 'orange' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'polyporus-tuberaster' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'polyporus-tuberaster' AND c.part = 'flesh' AND c.to_name = 'gelb' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'polyporus-umbellatus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-claroflava' AND c.part = 'flesh' AND c.to_name = 'rosa' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-claroflava' AND c.part = 'flesh' AND c.to_name = 'rosa' AND c.from_name IS NULL AND t.slug = 'formalin');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-cyanoxantha' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-cyanoxantha' AND c.part = 'flesh' AND c.to_name = 'grün' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-ochroleuca' AND c.part = 'flesh' AND c.to_name = 'rot' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-raoultii' AND c.part = 'flesh' AND c.to_name = 'rosa' AND c.from_name IS NULL AND t.slug = 'formalin');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-silvestris' AND c.part = 'flesh' AND c.to_name = 'rosa' AND c.from_name IS NULL AND t.slug = 'formalin');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-vesca' AND c.part = 'flesh' AND c.to_name = 'zitronengelb' AND c.from_name IS NULL AND t.slug = 'aniline');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'russula-virescens' AND c.part = 'flesh' AND c.to_name = 'rostbraun' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillellus-luridus' AND c.part = 'flesh' AND c.to_name = 'gelb' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillellus-luridus' AND c.part = 'flesh' AND c.to_name = 'orange' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-cavipes' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-cavipes-var-aereus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-grevillei' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-grevillei' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-grevillei' AND c.part = 'flesh' AND c.to_name = 'rot' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-placidus' AND c.part = 'flesh' AND c.to_name = 'blaugrün' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-placidus' AND c.part = 'flesh' AND c.to_name = 'braun' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'suillus-placidus' AND c.part = 'flesh' AND c.to_name = 'schwarz' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'tricholoma-atrosquamosum' AND c.part = 'flesh' AND c.to_name = 'gelb' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'tricholoma-myomyces' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'cut');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'tylopilus-felleus' AND c.part = 'flesh' AND c.to_name = 'grau' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'tylopilus-felleus' AND c.part = 'flesh' AND c.to_name = 'orange' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'tylopilus-felleus' AND c.part = 'flesh' AND c.to_name = 'rosa' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomellus-chrysenteron' AND c.part = 'flesh' AND c.to_name = 'oliv' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomellus-chrysenteron' AND c.part = 'flesh' AND c.to_name = 'orange' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomus-ferrugineus' AND c.part = 'flesh' AND c.to_name = 'braun' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomus-ferrugineus' AND c.part = 'flesh' AND c.to_name = 'grau' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomus-ferrugineus' AND c.part = 'flesh' AND c.to_name = 'hellbraun' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomus-lanatus' AND c.part = 'flesh' AND c.to_name = 'blau' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomus-subtomentosus' AND c.part = 'flesh' AND c.to_name = 'blaugrün' AND c.from_name IS NULL AND t.slug = 'ammonia');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomus-subtomentosus' AND c.part = 'flesh' AND c.to_name = 'grau' AND c.from_name IS NULL AND t.slug = 'feso4');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomus-subtomentosus' AND c.part = 'flesh' AND c.to_name = 'grün' AND c.from_name IS NULL AND t.slug = 'melzer');

DELETE FROM species_colour_change WHERE (species_id, position) IN (
	SELECT c.species_id, c.position FROM species_colour_change c
		JOIN species s ON s.id = c.species_id
		JOIN species_colour_change_trigger x ON x.species_id = c.species_id AND x.position = c.position
		JOIN term t ON t.id = x.term_id
		WHERE s.slug = 'xerocomus-subtomentosus' AND c.part = 'flesh' AND c.to_name = 'orangerot' AND c.from_name IS NULL AND t.slug = 'koh');

DELETE FROM species_colour_change_trigger WHERE NOT EXISTS (
	SELECT 1 FROM species_colour_change c
	WHERE c.species_id = species_colour_change_trigger.species_id AND c.position = species_colour_change_trigger.position);

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'orange', '#e08a2e'
	FROM species s WHERE s.slug = 'agaricus-arvensis' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'schaeffer');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'schaeffer' WHERE s.slug = 'agaricus-arvensis';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'gelb', '#e8c33a'
	FROM species s WHERE s.slug = 'albatrellus-citrinus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'albatrellus-citrinus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'rot', '#c0392b'
	FROM species s WHERE s.slug = 'albatrellus-cristatus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'albatrellus-cristatus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'stem', 'weinrot', '#7b2436'
	FROM species s WHERE s.slug = 'amanita-contui' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'phenol');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'phenol' WHERE s.slug = 'amanita-contui';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'blau', '#3a5f9e'
	FROM species s WHERE s.slug = 'amanita-fulva' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'guaiac');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'guaiac' WHERE s.slug = 'amanita-fulva';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'tubes', 'gelb', '#e8c33a'
	FROM species s WHERE s.slug = 'bondarzewia-mesenterica' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'bondarzewia-mesenterica';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'pores', 'rosa', '#e8a0b0'
	FROM species s WHERE s.slug = 'cerioporus-leptocephalus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'naoh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'naoh' WHERE s.slug = 'cerioporus-leptocephalus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'blutrot', '#8e1f1f'
	FROM species s WHERE s.slug = 'cortinarius-limonius' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'cortinarius-limonius';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'olivbraun', '#6e6435'
	FROM species s WHERE s.slug = 'cortinarius-meinhardii' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'cortinarius-meinhardii';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'schwarz', '#1a1a1a'
	FROM species s WHERE s.slug = 'cortinarius-rubellus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'cortinarius-rubellus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'blaugrün', '#2f7f7a'
	FROM species s WHERE s.slug = 'entoloma-sepium' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'guaiac');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'guaiac' WHERE s.slug = 'entoloma-sepium';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'rot', '#c0392b'
	FROM species s WHERE s.slug = 'galerina-marginata' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'galerina-marginata';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'stem_base', 'orangegelb', '#e9a32c'
	FROM species s WHERE s.slug = 'hygrophorus-mesotephrus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'hygrophorus-mesotephrus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'rot', '#c0392b'
	FROM species s WHERE s.slug = 'hypholoma-capnoides' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'hypholoma-capnoides';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'blaugrün', '#2f7f7a'
	FROM species s WHERE s.slug = 'imleria-badia' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'ammonia');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'ammonia' WHERE s.slug = 'imleria-badia';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'orange', '#e08a2e'
	FROM species s WHERE s.slug = 'imleria-badia' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'imleria-badia';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'gills', 'blau', '#3a5f9e'
	FROM species s WHERE s.slug = 'imleria-badia' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'melzer');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'melzer' WHERE s.slug = 'imleria-badia';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'olivgrün', '#6f8438'
	FROM species s WHERE s.slug = 'infundibulicybe-geotropa' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'infundibulicybe-geotropa';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'grau', '#8a8a8a'
	FROM species s WHERE s.slug = 'inocybe-hystrix' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'inocybe-hystrix';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'rot', '#c0392b'
	FROM species s WHERE s.slug = 'leccinum-aurantiacum' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'formalin');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'formalin' WHERE s.slug = 'leccinum-aurantiacum';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'gelb', '#e8c33a'
	FROM species s WHERE s.slug = 'lepista-flaccida' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'lepista-flaccida';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'grün', '#4f8a3a'
	FROM species s WHERE s.slug = 'omphalotus-olearius' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'ammonia');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'ammonia' WHERE s.slug = 'omphalotus-olearius';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'grün', '#4f8a3a'
	FROM species s WHERE s.slug = 'omphalotus-olearius' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'omphalotus-olearius';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'orange', '#e08a2e'
	FROM species s WHERE s.slug = 'pleurotus-pulmonarius' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'pleurotus-pulmonarius';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'pores', 'gelb', '#e8c33a'
	FROM species s WHERE s.slug = 'polyporus-tuberaster' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'polyporus-tuberaster';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'weinrot', '#7b2436'
	FROM species s WHERE s.slug = 'russula-claroflava' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'feso4');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'feso4' WHERE s.slug = 'russula-claroflava';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'stem', 'rosa', '#e8a0b0'
	FROM species s WHERE s.slug = 'russula-claroflava' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'formalin');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'formalin' WHERE s.slug = 'russula-claroflava';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'stem_base', 'rot', '#c0392b'
	FROM species s WHERE s.slug = 'russula-ochroleuca' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'russula-ochroleuca';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'stem', 'rosa', '#e8a0b0'
	FROM species s WHERE s.slug = 'russula-raoultii' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'formalin');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'formalin' WHERE s.slug = 'russula-raoultii';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'stem', 'rosa', '#e8a0b0'
	FROM species s WHERE s.slug = 'russula-silvestris' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'formalin');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'formalin' WHERE s.slug = 'russula-silvestris';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'gills', 'zitronengelb', '#f2e14c'
	FROM species s WHERE s.slug = 'russula-vesca' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'aniline');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'aniline' WHERE s.slug = 'russula-vesca';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'flesh', 'rosa', '#e8a0b0'
	FROM species s WHERE s.slug = 'russula-virescens' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'feso4');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'feso4' WHERE s.slug = 'russula-virescens';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'grau', '#8a8a8a'
	FROM species s WHERE s.slug = 'suillellus-luridus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'feso4');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'feso4' WHERE s.slug = 'suillellus-luridus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'rot', '#c0392b'
	FROM species s WHERE s.slug = 'suillellus-luridus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'suillellus-luridus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'grau', '#8a8a8a'
	FROM species s WHERE s.slug = 'suillus-grevillei' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'ammonia');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'ammonia' WHERE s.slug = 'suillus-grevillei';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'grau', '#8a8a8a'
	FROM species s WHERE s.slug = 'suillus-grevillei' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'suillus-grevillei';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'oliv', '#6b7a3a'
	FROM species s WHERE s.slug = 'suillus-grevillei' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'feso4');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'feso4' WHERE s.slug = 'suillus-grevillei';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'grau', '#8a8a8a'
	FROM species s WHERE s.slug = 'suillus-placidus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'feso4');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'feso4' WHERE s.slug = 'suillus-placidus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'violett', '#6b4a8a'
	FROM species s WHERE s.slug = 'suillus-placidus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'ammonia');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'ammonia' WHERE s.slug = 'suillus-placidus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'violett', '#6b4a8a'
	FROM species s WHERE s.slug = 'suillus-placidus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'suillus-placidus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'orange', '#e08a2e'
	FROM species s WHERE s.slug = 'tylopilus-felleus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'tylopilus-felleus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'tubes', 'grau', '#8a8a8a'
	FROM species s WHERE s.slug = 'tylopilus-felleus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'feso4');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'feso4' WHERE s.slug = 'tylopilus-felleus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'oliv', '#6b7a3a'
	FROM species s WHERE s.slug = 'xerocomellus-chrysenteron' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'feso4');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'feso4' WHERE s.slug = 'xerocomellus-chrysenteron';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'stem', 'orange', '#e08a2e'
	FROM species s WHERE s.slug = 'xerocomellus-chrysenteron' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'xerocomellus-chrysenteron';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'blaugrün', '#2f7f7a'
	FROM species s WHERE s.slug = 'xerocomus-ferrugineus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'ammonia');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'ammonia' WHERE s.slug = 'xerocomus-ferrugineus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'schwarz', '#1a1a1a'
	FROM species s WHERE s.slug = 'xerocomus-ferrugineus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'xerocomus-ferrugineus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'blau', '#3a5f9e'
	FROM species s WHERE s.slug = 'xerocomus-lanatus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'ammonia');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'ammonia' WHERE s.slug = 'xerocomus-lanatus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'blaugrün', '#2f7f7a'
	FROM species s WHERE s.slug = 'xerocomus-subtomentosus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'ammonia');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'ammonia' WHERE s.slug = 'xerocomus-subtomentosus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'cap', 'orangerot', '#df5a25'
	FROM species s WHERE s.slug = 'xerocomus-subtomentosus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'koh');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'koh' WHERE s.slug = 'xerocomus-subtomentosus';

INSERT INTO species_colour_change (species_id, position, part, to_name, to_hex)
	SELECT s.id, (SELECT coalesce(max(position), -1) + 1 FROM species_colour_change WHERE species_id = s.id), 'pores', 'grün', '#4f8a3a'
	FROM species s WHERE s.slug = 'xerocomus-subtomentosus' AND EXISTS (SELECT 1 FROM term WHERE kind = 'trigger' AND slug = 'melzer');
INSERT INTO species_colour_change_trigger (species_id, position, term_id)
	SELECT s.id, (SELECT max(position) FROM species_colour_change WHERE species_id = s.id), t.id
	FROM species s JOIN term t ON t.kind = 'trigger' AND t.slug = 'melzer' WHERE s.slug = 'xerocomus-subtomentosus';

-- The old import read "blau" inside "herablaufend" and gave the hymenium a blue that no text names.
DELETE FROM species_colour WHERE part = 'pores' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'albatrellus-citrinus');
DELETE FROM species_colour WHERE part = 'pores' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'albatrellus-cristatus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'amanita-phalloides');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'amanita-spissa');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'armillaria-gallica');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'armillaria-mellea');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'armillaria-ostoyae');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'atractosporocybe-inornata');
DELETE FROM species_colour WHERE part = 'pores' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'bondarzewia-mesenterica');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'calocybe-gambosa');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'calocybe-graveolens');
DELETE FROM species_colour WHERE part = 'pores' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'cerioporus-leptocephalus');
DELETE FROM species_colour WHERE part = 'pores' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'cerioporus-squamosus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'chroogomphus-fulmineus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'chroogomphus-helveticus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'chroogomphus-rutilus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'chrysomphalina-grossula');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'clitocybe-ditopa');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'clitocybe-maxima');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'clitocybe-nebularis');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'clitocybe-obsoleta');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'clitocybe-phyllophila');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'clitocybe-rivulosa');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'clitopilus-prunulus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'cortinarius-rubellus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'desarmillaria-tabescens');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'entoloma-lividoalbum');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'entoloma-sinuatum');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'faerberia-carbonaria');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'galerina-marginata');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'gomphidius-glutinosus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'gomphidius-roseus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'gymnopilus-penetrans');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'gymnopilus-picreus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'gymnopilus-sapineus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrocybe-turunda');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophoropsis-aurantiaca');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophoropsis-rufa');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophorus-gliocyclus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophorus-inocybiformis');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophorus-latitabundus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophorus-marzuolus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophorus-mesotephrus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'infundibulicybe-geotropa');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'infundibulicybe-gibba');
DELETE FROM species_colour WHERE part = 'pores' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'jahnoporus-hirtus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'kuehneromyces-mutabilis');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lactarius-deterrimus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lactarius-helvus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lactarius-hysginus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lactarius-quietus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lactarius-volemus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lactifluus-rugatus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lepista-flaccida');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lepista-panaeolus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lepista-sordida');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'leucopaxillus-giganteus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'lyophyllum-decastes');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'melanoleuca-grammopodia');
DELETE FROM species_colour WHERE part = 'pores' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'meripilus-giganteus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'mucidula-mucida');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'neolentinus-cyathiformis');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'neolentinus-lepideus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'omphalotus-olearius');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'osteina-obducta');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'panellus-serotinus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'pholiota-lignicola');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'pholiota-spumosa');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'pholiota-squarrosoides');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'pleurotus-cornucopiae');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'pleurotus-djamor');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'pleurotus-dryinus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'pleurotus-ostreatus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'pleurotus-pulmonarius');
DELETE FROM species_colour WHERE part = 'pores' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'polyporus-tuberaster');
DELETE FROM species_colour WHERE part = 'pores' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'polyporus-umbellatus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'russula-aeruginea');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillus-bovinus');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillus-cavipes');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillus-cavipes-var-aereus');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillus-placidus');
DELETE FROM species_colour WHERE part = 'gills' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'tricholoma-myomyces');
DELETE FROM species_colour WHERE part = 'tubes' AND name = 'blau' AND hex = '#3a5f9e'
	AND species_id = (SELECT id FROM species WHERE slug = 'xerocomellus-chrysenteron');
DELETE FROM species_colour_range WHERE part = 'gills' AND species_id = (SELECT id FROM species WHERE slug = 'lactarius-quietus')
	AND NOT EXISTS (SELECT 1 FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = species_colour_range.part);
DELETE FROM species_colour_range WHERE part = 'gills' AND species_id = (SELECT id FROM species WHERE slug = 'lactifluus-rugatus')
	AND NOT EXISTS (SELECT 1 FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = species_colour_range.part);
DELETE FROM species_colour_range WHERE part = 'gills' AND species_id = (SELECT id FROM species WHERE slug = 'neolentinus-cyathiformis')
	AND NOT EXISTS (SELECT 1 FROM species_colour c WHERE c.species_id = species_colour_range.species_id AND c.part = species_colour_range.part);
UPDATE species_colour_range SET mode = 'single' WHERE part = 'pores' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'albatrellus-citrinus');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'amanita-phalloides');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'amanita-spissa');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'chrysomphalina-grossula');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'cortinarius-rubellus');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'desarmillaria-tabescens');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophorus-gliocyclus');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophorus-inocybiformis');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'hygrophorus-mesotephrus');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'infundibulicybe-gibba');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'pores' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'jahnoporus-hirtus');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'lyophyllum-decastes');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'gills' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'omphalotus-olearius');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'tubes' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillus-cavipes');
UPDATE species_colour_range SET mode = 'single' WHERE part = 'tubes' AND mode = 'distinct'
	AND species_id = (SELECT id FROM species WHERE slug = 'suillus-cavipes-var-aereus');

-- A further source with the address of the profile source repeats it.
DELETE FROM species_source WHERE scope = 'further' AND EXISTS (
	SELECT 1 FROM species_source p WHERE p.species_id = species_source.species_id AND p.scope = 'profile'
	AND lower(rtrim(p.url, '/')) = lower(rtrim(species_source.url, '/')));
