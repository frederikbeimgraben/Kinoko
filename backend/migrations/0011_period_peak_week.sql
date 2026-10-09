-- The season editor gives the peak as a calendar week, as the board EditSeason shows it.
-- The peak month stays: the catalogue files and older clients use it.
ALTER TABLE species ADD COLUMN period_peak_week INTEGER CHECK (period_peak_week BETWEEN 1 AND 53);
