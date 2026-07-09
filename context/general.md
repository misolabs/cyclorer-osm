cyclorer-osm

node.js rest api server, framework to be determined (fastify?)
general purpose is to serve tile-based osm data extracts to a client web application
should be deployable on fly.io
osm data should be retrieved by overpass api and cached locally for a specified time period
raw osm data should be preprocessed before running through osmtogeojson
geojson data should be post-processed before caching and serving to the client
