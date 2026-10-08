-- Data sources of the pipeline: admin uploads with their versions and
-- derived files, upload sessions, the cache of the public sources, the
-- inputs of each run and the forecast chain of each species.

CREATE TABLE data_source_version (
	id CHAR(32) NOT NULL,
	kind VARCHAR(40) NOT NULL,
	version INTEGER NOT NULL,
	origin VARCHAR(20) NOT NULL,
	derived_from_id CHAR(32),
	state VARCHAR(20) NOT NULL,
	active BOOLEAN NOT NULL DEFAULT 0,
	file_name VARCHAR(255),
	size_bytes INTEGER,
	sha256 VARCHAR(64),
	storage_path TEXT NOT NULL,
	species_id CHAR(32),
	metadata TEXT NOT NULL DEFAULT '{}',
	error_code VARCHAR(60),
	error_detail TEXT,
	log_path TEXT,
	created_by_id CHAR(32),
	created_at DATETIME NOT NULL,
	processed_at DATETIME,
	activated_at DATETIME,
	PRIMARY KEY (id),
	FOREIGN KEY(derived_from_id) REFERENCES data_source_version (id) ON DELETE SET NULL,
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE,
	FOREIGN KEY(created_by_id) REFERENCES user (id) ON DELETE SET NULL,
	CHECK (origin IN ('upload', 'derived', 'training')),
	CHECK (state IN ('validating', 'processing', 'ready', 'failed', 'superseded'))
);

-- A NULL species makes each row distinct in a plain UNIQUE constraint.
-- The expression index treats all versions without a species as one group.
CREATE UNIQUE INDEX ix_data_source_version_number
	ON data_source_version (kind, coalesce(species_id, ''), version);

CREATE UNIQUE INDEX ix_data_source_version_one_active
	ON data_source_version (kind, coalesce(species_id, '')) WHERE active = 1;

CREATE INDEX ix_data_source_version_derived_from ON data_source_version (derived_from_id);

CREATE TABLE data_source_artifact (
	version_id CHAR(32) NOT NULL,
	name VARCHAR(200) NOT NULL,
	path TEXT NOT NULL,
	size_bytes INTEGER NOT NULL,
	sha256 VARCHAR(64),
	PRIMARY KEY (version_id, name),
	FOREIGN KEY(version_id) REFERENCES data_source_version (id) ON DELETE CASCADE
);

CREATE TABLE data_source_upload (
	id CHAR(32) NOT NULL,
	kind VARCHAR(40) NOT NULL,
	species_id CHAR(32),
	file_name VARCHAR(255) NOT NULL,
	size_bytes INTEGER NOT NULL,
	expected_sha256 VARCHAR(64),
	received_bytes INTEGER NOT NULL DEFAULT 0,
	part_size INTEGER NOT NULL,
	hash_state BLOB,
	temp_path TEXT NOT NULL,
	activate BOOLEAN NOT NULL DEFAULT 1,
	state VARCHAR(20) NOT NULL,
	version_id CHAR(32),
	created_by_id CHAR(32),
	created_at DATETIME NOT NULL,
	expires_at DATETIME NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE,
	FOREIGN KEY(version_id) REFERENCES data_source_version (id) ON DELETE SET NULL,
	FOREIGN KEY(created_by_id) REFERENCES user (id) ON DELETE SET NULL,
	CHECK (state IN ('open', 'complete', 'aborted', 'expired'))
);

CREATE INDEX ix_data_source_upload_kind_state ON data_source_upload (kind, state);

CREATE TABLE remote_cache_file (
	source VARCHAR(40) NOT NULL,
	"key" TEXT NOT NULL,
	url TEXT NOT NULL,
	etag TEXT,
	last_modified TEXT,
	size_bytes INTEGER,
	sha256 VARCHAR(64),
	fetched_at DATETIME,
	checked_at DATETIME,
	state VARCHAR(20) NOT NULL,
	error TEXT,
	PRIMARY KEY (source, "key")
);

CREATE TABLE pipeline_run_input (
	run_id CHAR(32) NOT NULL,
	kind VARCHAR(40) NOT NULL,
	version_id CHAR(32),
	remote_snapshot TEXT,
	PRIMARY KEY (run_id, kind),
	FOREIGN KEY(run_id) REFERENCES pipeline_run (id) ON DELETE CASCADE,
	FOREIGN KEY(version_id) REFERENCES data_source_version (id) ON DELETE SET NULL
);

-- The parameters of a fetch run. pipeline_run has no column for them.
CREATE TABLE remote_fetch_request (
	run_id CHAR(32) NOT NULL,
	source VARCHAR(40) NOT NULL,
	from_year INTEGER,
	to_year INTEGER,
	force BOOLEAN NOT NULL DEFAULT 0,
	PRIMARY KEY (run_id),
	FOREIGN KEY(run_id) REFERENCES pipeline_run (id) ON DELETE CASCADE
);

-- The forecast chain of a species. The sources module seeds it at start
-- from the list of run_all.sh, because the catalog seed adds the species.
CREATE TABLE species_forecast (
	species_id CHAR(32) NOT NULL,
	chain_key VARCHAR(80) NOT NULL,
	taxa TEXT NOT NULL,
	min_forest FLOAT NOT NULL DEFAULT 0.03,
	PRIMARY KEY (species_id),
	FOREIGN KEY(species_id) REFERENCES species (id) ON DELETE CASCADE,
	UNIQUE (chain_key)
);
