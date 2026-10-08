-- Chemical reactions of a species to a reagent, with the sources.
-- The seed is daten/reaktionen.json. A reaction can be negative or variable,
-- so it is not a colour change.

CREATE TABLE reaction_source (
	id CHAR(32) NOT NULL,
	"key" VARCHAR(40) NOT NULL,
	label TEXT NOT NULL,
	url TEXT,
	year VARCHAR(20),
	PRIMARY KEY (id),
	UNIQUE ("key")
);

CREATE TABLE species_reaction (
	species_id CHAR(32) NOT NULL,
	position INTEGER NOT NULL,
	term_id CHAR(32) NOT NULL,
	reading TEXT NOT NULL,
	part VARCHAR(20),
	location TEXT,
	result VARCHAR(20) NOT NULL,
	colour_name VARCHAR(120),
	colour_hex VARCHAR(7),
	contested BOOLEAN NOT NULL DEFAULT 0,
	partly_confirmed BOOLEAN NOT NULL DEFAULT 0,
	PRIMARY KEY (species_id, position),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE,
	FOREIGN KEY(term_id) REFERENCES term (id) ON DELETE CASCADE,
	CHECK (result IN ('positive', 'negative', 'variable', 'unknown'))
);

CREATE INDEX ix_species_reaction_term ON species_reaction (term_id);

CREATE TABLE species_reaction_source (
	species_id CHAR(32) NOT NULL,
	position INTEGER NOT NULL,
	source_id CHAR(32) NOT NULL,
	PRIMARY KEY (species_id, position, source_id),
	FOREIGN KEY(species_id, position) REFERENCES species_reaction (species_id, position) ON DELETE CASCADE,
	FOREIGN KEY(source_id) REFERENCES reaction_source (id) ON DELETE CASCADE
);
