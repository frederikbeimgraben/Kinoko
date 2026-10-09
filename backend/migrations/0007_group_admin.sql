-- A person in the admin group of the SSO is an admin without a stored role. The flag keeps this
-- for the role counts and the people list. Each sign-in sets it again.
ALTER TABLE user ADD COLUMN group_admin BOOLEAN NOT NULL DEFAULT FALSE;
