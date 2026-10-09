-- The object colours follow the chips of the mockups: green, yellow, orange,
-- red, violet and grey. Each old value goes to the nearest new value.

UPDATE marker SET colour = CASE colour
	WHEN 'brown' THEN 'orange'
	WHEN 'gold' THEN 'yellow'
	WHEN 'blue' THEN 'violet'
	ELSE colour
END;

UPDATE zone SET colour = CASE colour
	WHEN 'brown' THEN 'orange'
	WHEN 'gold' THEN 'yellow'
	WHEN 'blue' THEN 'violet'
	ELSE colour
END;
