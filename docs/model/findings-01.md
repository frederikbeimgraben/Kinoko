# First results: Boletus edulis

This file is a research note of the earlier research chain in Python
(`modell/`). The repository does not hold that code any more. The results
are the base of the model design that the Go pipeline keeps.

Date: 2026-09-06. Data: 626,420 of 746,827 GBIF records. The download of
October to December 2025 and of all of 2026 was not complete. Thus do this
run again later.

Training table: 125,449 cell-weeks, 2,632 of them positive. The base rate is
2.08 percent. The cells are 5 km in EPSG:3035. The steps are ISO weeks. The
rows cover 2015 to 2025.

## Feature sets

| Set | Features |
|---|---|
| effort_only | record count, species count, observer count |
| season | effort + week of the year |
| place | season + cell position |
| weather | place + lagged rain, temperature and soil moisture |
| weather_noeffort | the same as weather, but without the effort columns |

## Results

AUC and average precision (AP), mean of the folds:

| Set | Year AUC | Year AP | Space AUC | Space AP |
|---|---|---|---|---|
| effort_only | 0.819 | 0.189 | 0.802 | 0.164 |
| season | 0.863 | 0.221 | 0.865 | 0.197 |
| place | 0.876 | 0.261 | 0.856 | 0.192 |
| weather | **0.885** | **0.275** | **0.878** | **0.225** |
| weather_noeffort | 0.807 | 0.109 | 0.795 | 0.071 |

The folds are blocked. The year scheme holds out one full year, eleven times.
The space scheme holds out one band of cells about 100 km wide, seven times.

## The main finding

The survey effort alone gets an AUC of 0.819. All other features together,
without the effort columns, get 0.807. The strongest single signal in this
dataset is how much people looked, not what the weather did.

This is more important than it seems, because **nobody can know the effort
columns in advance**. Nobody knows how many species other people will report
in a cell next week. Thus a forecast model must run without them.

The row for the real forecast skill is weather_noeffort. It has an AUC of
0.807 and an average precision of 0.109. The base rate is 0.021. That is about
five times better than chance. It is a real signal. It is not yet a useful
forecast.

The target-group background removed a part of the effort effect, as intended.
It did not remove enough.

## The effect of the weather

With year blocks, the weather adds 0.009 AUC to season and place. With space
blocks, it adds 0.022. The increase is small, but it is the same in the two
fold schemes.

The features that the model selected agree with the biology. Rain at a lag of
two to eight weeks has the ranks 5, 6, 9, 12 and 13 by gain. These ranks are
above the rain of the current week. Rolling rain sums over four and eight weeks
also have high ranks. Fruiting follows rain after a delay. The model found that
delay without help.

The cell position helps with year blocks and has a bad effect with space
blocks (0.865 to 0.856). Raw coordinates cannot extrapolate into a region that
the model did not see. Replace them with site properties.

## The negative result

The DWD soil moisture grids added nothing. None of the sixteen paws features
got into the top thirty by gain, for any of the four tree species. The
download was about 9 GB.

There are two probable causes:

- The values have a strong correlation with recent rain, which the model already has.
- The stand type of the grid tells the soil moisture under spruce, beech, oak or pine. It does not tell which of them grows in the cell. Until the model knows the real forest composition, the four fields are four forms of the same value.

Test the anomaly, not the value. Soil moisture 30 percent below the normal of
that cell and week is probably more important than 90 percent nFK.

## Calibration

The model gives the correct shape of the season. The peak is week 39, at the
end of September. This agrees with the known season. January to May is almost
zero.

The peak is too low. In week 39, the observed rate is 0.064 and the mean
prediction is 0.043. The model is not confident enough where it is most
important.

## Next steps

1. Replace the effort columns with values that are known in advance: the mean effort of that cell in that week of the year in past years, the population density, the distance to a road or a car park, and a weekend flag.
2. Add the static site data. The DEM, SoilGrids and the OpenStreetMap forest polygons are available, but no model uses them yet. They also replace the raw cell position, which fails across regions.
3. Put species into groups that share a host tree. Boletus edulis alone gives 2,632 positive cell-weeks. That is too few to learn a lag structure well.
4. Use the soil moisture anomaly, not the soil moisture.
