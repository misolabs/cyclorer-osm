#api
- high-level cache based on endpoint name and parameters
- validation of input, conversion of parameters
- call services
- prepare response, cache response

#service
- retrieve raw data from overpass layer / osm provider layer
- process data, convert to geojson, calculate properties

#overpass
- execute overpass queries
- low-level caching