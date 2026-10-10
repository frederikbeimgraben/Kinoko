-- The shape of the ring on the stem, a value of RingShape. The species page,
-- the compare table and the part editor show it.
ALTER TABLE species ADD COLUMN ring_shape VARCHAR(20);
