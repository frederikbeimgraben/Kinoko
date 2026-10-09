-- The SHA-256 digest of a seed file at its last import. A start imports the file again only when the digest changed.
CREATE TABLE seed_digest (
	name VARCHAR(120) NOT NULL,
	digest CHAR(64) NOT NULL,
	PRIMARY KEY (name)
);
