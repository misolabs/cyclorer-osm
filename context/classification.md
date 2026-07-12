no-go

```
["bicycle"="no"];
["access"="no"]["bicycle"!="yes"];
access=private
```

ideal for cycling

```
// Part of a cycling relation

// Dedicated cycleway
way.searchWays["highway"="cycleway"];

// There is some kind of cycleway included
// Could also be a bike lane
way.searchWays["cycleway"];

// Segment that is specifically designed for bikes
way.searchWays["bicycle"="designated"];

// Residential street with speed limit <= 30
way.searchWays["maxspeed"](if:t["maxspeed"] <= 30);

// Walking path/track that is bike friendly
// Not used often enough
way.searchWays["bicycle"="yes"]["highway"~"path|track"];
```