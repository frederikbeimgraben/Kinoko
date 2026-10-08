-- The schema of the old service at alembic revision baseline_4.
-- Do not change this file. Add a new migration for each change.
CREATE TABLE permission (
	"key" VARCHAR(80) NOT NULL,
	area VARCHAR(20) NOT NULL,
	PRIMARY KEY ("key")
);

CREATE TABLE role (
	id CHAR(32) NOT NULL,
	slug VARCHAR(80) NOT NULL,
	name VARCHAR(120) NOT NULL,
	description TEXT,
	built_in BOOLEAN NOT NULL,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	PRIMARY KEY (id),
	UNIQUE (slug)
);

CREATE TABLE taxon (
	id CHAR(32) NOT NULL,
	rank VARCHAR(20) NOT NULL,
	slug VARCHAR(80) NOT NULL,
	name VARCHAR(120) NOT NULL,
	latin_name VARCHAR(120) NOT NULL,
	description TEXT,
	parent_id CHAR(32),
	PRIMARY KEY (id),
	FOREIGN KEY(parent_id) REFERENCES taxon (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX ix_taxon_rank_slug ON taxon (rank, slug);

CREATE TABLE term (
	id CHAR(32) NOT NULL,
	kind VARCHAR(20) NOT NULL,
	group_key VARCHAR(20),
	slug VARCHAR(80) NOT NULL,
	name VARCHAR(120) NOT NULL,
	position INTEGER NOT NULL,
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_term_kind_slug ON term (kind, slug);

CREATE TABLE user (
	id CHAR(32) NOT NULL,
	sub VARCHAR(128) NOT NULL,
	email VARCHAR(120),
	name VARCHAR(120),
	created_at DATETIME NOT NULL,
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_user_sub ON user (sub);

CREATE TABLE combination (
	id CHAR(32) NOT NULL,
	owner_id CHAR(32) NOT NULL,
	name VARCHAR(120) NOT NULL,
	rule VARCHAR(20) NOT NULL,
	factors TEXT NOT NULL,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	deleted_at DATETIME,
	PRIMARY KEY (id),
	FOREIGN KEY(owner_id) REFERENCES user (id) ON DELETE CASCADE
);

CREATE INDEX ix_combination_owner_updated ON combination (owner_id, updated_at);

CREATE TABLE glossary_entry (
	id CHAR(32) NOT NULL,
	term VARCHAR(120) NOT NULL,
	definition TEXT NOT NULL,
	updated_at DATETIME NOT NULL,
	updated_by_id CHAR(32),
	PRIMARY KEY (id),
	FOREIGN KEY(updated_by_id) REFERENCES user (id) ON DELETE SET NULL,
	UNIQUE (term)
);

CREATE TABLE "group" (
	id CHAR(32) NOT NULL,
	name VARCHAR(60) NOT NULL,
	owner_id CHAR(32) NOT NULL,
	invite_code VARCHAR(16) NOT NULL,
	created_at DATETIME NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(owner_id) REFERENCES user (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX ix_group_invite_code ON "group" (invite_code);

CREATE TABLE pipeline_run (
	id CHAR(32) NOT NULL,
	kind VARCHAR(20) NOT NULL,
	state VARCHAR(20) NOT NULL,
	queued_at DATETIME NOT NULL,
	started_at DATETIME,
	finished_at DATETIME,
	log_path TEXT,
	metric_brier FLOAT,
	progress_done INTEGER NOT NULL,
	progress_total INTEGER NOT NULL,
	triggered_by_id CHAR(32),
	PRIMARY KEY (id),
	FOREIGN KEY(triggered_by_id) REFERENCES user (id) ON DELETE SET NULL
);

CREATE TABLE role_permission (
	role_id CHAR(32) NOT NULL,
	permission_key VARCHAR(80) NOT NULL,
	PRIMARY KEY (role_id, permission_key),
	FOREIGN KEY(permission_key) REFERENCES permission ("key") ON DELETE CASCADE,
	FOREIGN KEY(role_id) REFERENCES role (id) ON DELETE CASCADE
);

CREATE TABLE species (
	id CHAR(32) NOT NULL,
	slug VARCHAR(80) NOT NULL,
	name VARCHAR(120) NOT NULL,
	latin_name VARCHAR(120) NOT NULL,
	taxon_id CHAR(32),
	group_key VARCHAR(40) NOT NULL,
	edibility VARCHAR(30) NOT NULL,
	marketable BOOLEAN NOT NULL,
	forecast_enabled BOOLEAN NOT NULL,
	frequency VARCHAR(20),
	red_list VARCHAR(30),
	description TEXT,
	edibility_note TEXT,
	protection VARCHAR(20) NOT NULL,
	protection_note TEXT,
	period_start_month INTEGER,
	period_end_month INTEGER,
	period_peak_month INTEGER,
	smell_text TEXT,
	taste_text TEXT,
	hymenium_type VARCHAR(20),
	gill_attachment VARCHAR(20),
	gill_spacing VARCHAR(20),
	gill_edge VARCHAR(20),
	cap_shape_young VARCHAR(20),
	cap_shape_old VARCHAR(20),
	updated_at DATETIME NOT NULL,
	updated_by_id CHAR(32),
	PRIMARY KEY (id),
	FOREIGN KEY(taxon_id) REFERENCES taxon (id) ON DELETE SET NULL,
	FOREIGN KEY(updated_by_id) REFERENCES user (id) ON DELETE SET NULL,
	UNIQUE (latin_name),
	UNIQUE (name),
	UNIQUE (slug)
);

CREATE TABLE text (
	"key" VARCHAR(120) NOT NULL,
	locale VARCHAR(10) NOT NULL,
	value TEXT NOT NULL,
	updated_at DATETIME NOT NULL,
	updated_by_id CHAR(32),
	PRIMARY KEY ("key", locale),
	FOREIGN KEY(updated_by_id) REFERENCES user (id) ON DELETE SET NULL
);

CREATE TABLE user_role (
	user_id CHAR(32) NOT NULL,
	role_id CHAR(32) NOT NULL,
	granted_at DATETIME NOT NULL,
	PRIMARY KEY (user_id, role_id),
	FOREIGN KEY(role_id) REFERENCES role (id) ON DELETE CASCADE,
	FOREIGN KEY(user_id) REFERENCES user (id) ON DELETE CASCADE
);

CREATE TABLE find (
	id CHAR(32) NOT NULL,
	owner_id CHAR(32) NOT NULL,
	species_id CHAR(32),
	lat FLOAT NOT NULL,
	lon FLOAT NOT NULL,
	found_on DATE NOT NULL,
	count INTEGER,
	for_training BOOLEAN NOT NULL,
	review_state VARCHAR(20) NOT NULL,
	reviewed_by_id CHAR(32),
	reviewed_at DATETIME,
	visibility VARCHAR(20) NOT NULL,
	group_id CHAR(32),
	note TEXT,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	deleted_at DATETIME,
	PRIMARY KEY (id),
	FOREIGN KEY(group_id) REFERENCES "group" (id) ON DELETE SET NULL,
	FOREIGN KEY(owner_id) REFERENCES user (id) ON DELETE CASCADE,
	FOREIGN KEY(reviewed_by_id) REFERENCES user (id) ON DELETE SET NULL,
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE SET NULL
);

CREATE INDEX ix_find_owner_updated ON find (owner_id, updated_at);

CREATE TABLE group_member (
	group_id CHAR(32) NOT NULL,
	user_id CHAR(32) NOT NULL,
	joined_at DATETIME NOT NULL,
	PRIMARY KEY (group_id, user_id),
	FOREIGN KEY(group_id) REFERENCES "group" (id) ON DELETE CASCADE,
	FOREIGN KEY(user_id) REFERENCES user (id) ON DELETE CASCADE
);

CREATE TABLE marker (
	id CHAR(32) NOT NULL,
	owner_id CHAR(32) NOT NULL,
	name VARCHAR(120) NOT NULL,
	lat FLOAT NOT NULL,
	lon FLOAT NOT NULL,
	colour VARCHAR(20) NOT NULL,
	visibility VARCHAR(20) NOT NULL,
	group_id CHAR(32),
	note TEXT,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	deleted_at DATETIME,
	PRIMARY KEY (id),
	FOREIGN KEY(group_id) REFERENCES "group" (id) ON DELETE SET NULL,
	FOREIGN KEY(owner_id) REFERENCES user (id) ON DELETE CASCADE
);

CREATE INDEX ix_marker_owner_updated ON marker (owner_id, updated_at);

CREATE TABLE pipeline_run_species (
	run_id CHAR(32) NOT NULL,
	species_id CHAR(32) NOT NULL,
	state VARCHAR(20) NOT NULL,
	record_count INTEGER NOT NULL,
	find_count INTEGER NOT NULL,
	PRIMARY KEY (run_id, species_id),
	FOREIGN KEY(run_id) REFERENCES pipeline_run (id) ON DELETE CASCADE,
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE pipeline_run_step (
	run_id CHAR(32) NOT NULL,
	position INTEGER NOT NULL,
	name VARCHAR(120) NOT NULL,
	state VARCHAR(20) NOT NULL,
	duration_s INTEGER,
	PRIMARY KEY (run_id, position),
	FOREIGN KEY(run_id) REFERENCES pipeline_run (id) ON DELETE CASCADE
);

CREATE TABLE species_colour_change (
	species_id CHAR(32) NOT NULL,
	position INTEGER NOT NULL,
	part VARCHAR(20) NOT NULL,
	from_name VARCHAR(120),
	from_hex VARCHAR(7),
	to_name VARCHAR(120) NOT NULL,
	to_hex VARCHAR(7) NOT NULL,
	speed VARCHAR(20),
	PRIMARY KEY (species_id, position),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE species_colour_range (
	species_id CHAR(32) NOT NULL,
	part VARCHAR(20) NOT NULL,
	mode VARCHAR(20) NOT NULL,
	PRIMARY KEY (species_id, part),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE species_lookalike (
	species_a_id CHAR(32) NOT NULL,
	species_b_id CHAR(32) NOT NULL,
	difference_a TEXT,
	difference_b TEXT,
	PRIMARY KEY (species_a_id, species_b_id),
	CONSTRAINT ck_lookalike_order CHECK (species_a_id < species_b_id),
	FOREIGN KEY(species_a_id) REFERENCES species (id) ON DELETE CASCADE,
	FOREIGN KEY(species_b_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE species_measurement (
	species_id CHAR(32) NOT NULL,
	part VARCHAR(20) NOT NULL,
	dimension VARCHAR(20) NOT NULL,
	low FLOAT NOT NULL,
	high FLOAT NOT NULL,
	unit VARCHAR(10) NOT NULL,
	PRIMARY KEY (species_id, part, dimension),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE species_name (
	species_id CHAR(32) NOT NULL,
	position INTEGER NOT NULL,
	name VARCHAR(120) NOT NULL,
	kind VARCHAR(20) NOT NULL,
	PRIMARY KEY (species_id, position),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE species_part_feature (
	species_id CHAR(32) NOT NULL,
	part VARCHAR(20) NOT NULL,
	feature VARCHAR(30) NOT NULL,
	phase VARCHAR(10) NOT NULL,
	PRIMARY KEY (species_id, part, feature, phase),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE species_part_note (
	species_id CHAR(32) NOT NULL,
	part VARCHAR(20) NOT NULL,
	description TEXT NOT NULL,
	comment TEXT NOT NULL,
	PRIMARY KEY (species_id, part),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE species_season (
	species_id CHAR(32) NOT NULL,
	season VARCHAR(20) NOT NULL,
	PRIMARY KEY (species_id, season),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE species_source (
	species_id CHAR(32) NOT NULL,
	position INTEGER NOT NULL,
	scope VARCHAR(20) NOT NULL,
	title VARCHAR(120) NOT NULL,
	url TEXT NOT NULL,
	checked_on DATE NOT NULL,
	PRIMARY KEY (species_id, position),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE species_term (
	species_id CHAR(32) NOT NULL,
	term_id CHAR(32) NOT NULL,
	from_experience BOOLEAN NOT NULL,
	PRIMARY KEY (species_id, term_id),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE,
	FOREIGN KEY(term_id) REFERENCES term (id) ON DELETE CASCADE
);

CREATE TABLE species_trait (
	species_id CHAR(32) NOT NULL,
	"key" VARCHAR(30) NOT NULL,
	body TEXT NOT NULL,
	PRIMARY KEY (species_id, "key"),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE TABLE zone (
	id CHAR(32) NOT NULL,
	owner_id CHAR(32) NOT NULL,
	name VARCHAR(120) NOT NULL,
	polygon TEXT NOT NULL,
	area_ha FLOAT NOT NULL,
	colour VARCHAR(20) NOT NULL,
	visibility VARCHAR(20) NOT NULL,
	group_id CHAR(32),
	note TEXT,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	deleted_at DATETIME,
	PRIMARY KEY (id),
	FOREIGN KEY(group_id) REFERENCES "group" (id) ON DELETE SET NULL,
	FOREIGN KEY(owner_id) REFERENCES user (id) ON DELETE CASCADE
);

CREATE INDEX ix_zone_owner_updated ON zone (owner_id, updated_at);

CREATE TABLE photo (
	id CHAR(32) NOT NULL,
	owner_id CHAR(32),
	find_id CHAR(32),
	species_id CHAR(32),
	width INTEGER NOT NULL,
	height INTEGER NOT NULL,
	photographer VARCHAR(120) NOT NULL,
	licence VARCHAR(20) NOT NULL,
	source TEXT,
	taken_on DATE,
	caption VARCHAR(200),
	lat FLOAT,
	lon FLOAT,
	lead BOOLEAN NOT NULL,
	state VARCHAR(20) NOT NULL,
	reject_reason VARCHAR(200),
	reviewed_by_id CHAR(32),
	reviewed_at DATETIME,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(find_id) REFERENCES find (id) ON DELETE SET NULL,
	FOREIGN KEY(owner_id) REFERENCES user (id) ON DELETE SET NULL,
	FOREIGN KEY(reviewed_by_id) REFERENCES user (id) ON DELETE SET NULL,
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE
);

CREATE INDEX ix_photo_species_state ON photo (species_id, state);

CREATE TABLE pipeline_run_find (
	run_id CHAR(32) NOT NULL,
	find_id CHAR(32) NOT NULL,
	PRIMARY KEY (run_id, find_id),
	FOREIGN KEY(find_id) REFERENCES find (id) ON DELETE CASCADE,
	FOREIGN KEY(run_id) REFERENCES pipeline_run (id) ON DELETE CASCADE
);

CREATE TABLE species_colour (
	species_id CHAR(32) NOT NULL,
	part VARCHAR(20) NOT NULL,
	position INTEGER NOT NULL,
	name VARCHAR(120) NOT NULL,
	hex VARCHAR(7) NOT NULL,
	PRIMARY KEY (species_id, part, position),
	FOREIGN KEY(species_id, part) REFERENCES species_colour_range (species_id, part) ON DELETE CASCADE
);

CREATE TABLE species_colour_change_trigger (
	species_id CHAR(32) NOT NULL,
	position INTEGER NOT NULL,
	term_id CHAR(32) NOT NULL,
	PRIMARY KEY (species_id, position, term_id),
	FOREIGN KEY(species_id, position) REFERENCES species_colour_change (species_id, position) ON DELETE CASCADE,
	FOREIGN KEY(term_id) REFERENCES term (id) ON DELETE CASCADE
);
