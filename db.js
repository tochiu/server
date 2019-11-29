const moment = require('moment-timezone');
const Pool = require('pg').Pool
const pool = new Pool({
	user: 'postgres',
	host: 'localhost',
	database: 'flight_booker',
	password: '',
	port: 5432,
});

const basic_query = async (text) => {
	try {
		return await pool.query(text);
	} catch (err) {
		console.log(err.stack);
	}
}

// make strings search friendly by
// 		removing surrounding whitespace
// 		removing non alphanumeric characters
// 		making all characters lower case
// 		making the whitespace difference between any two group of alphanumeric characters at most 1 ( e.g. "a   b" => "a b")
const formatForSearch = string => string
	.trim()
	.toLowerCase()
	.replace(/\s+/g, " ")
	.replace(/[^\w\s\d]/g, "");

// city location data // country, city, state [could be null], timecode
// added fields: formatted.city, formatted.state, formatted.country -> search friendly versions
const locations = {};

// airport data // iata, name, location
// added fields: 	formatted.name, formatted.IATA 	-> search fiendly versions
//								locationData 										-> location data based on location field
const airports  = [];

// airports indexed by their IATA code
const airportIATA = {};

// timezone offsets indexed by IANA code
const tzoffsets = {};

(async () => {
  try {
		
		// cache and reformat location data
		(await basic_query("SELECT * FROM LOCATION")).rows.forEach(location => {
			let { city, state, country } = location;
			
			// EDGE CASE:
			// if the location is in the US, don't include the country in the full name string  
			// ex. "Chicago, Illinois" instead of "Chicago, Illinois, United States"
			if (location.country !== "United States") {
				location.full = city + (state ? ", " + state : "") + ", " + country;
			} else {
				location.full = city + ", " + (state || "USA");
			}
			
			location.formatted = {
				city:          formatForSearch(city),
				state: state ? formatForSearch(state) : undefined,
				country:       formatForSearch(country),
				full:          formatForSearch(location.full)
			};

			tzoffsets[location.timecode] = moment.tz(moment.utc(), location.timecode).utcOffset();
			locations[location.city + " @ " + location.country] = location;
		});

		// cache and reformat airport data
		(await basic_query("SELECT * FROM AIRPORT")).rows.forEach(airport => {
			airport.location = airport.city + " @ " + airport.country;
			delete airport.city;
			delete airport.country;

			airport.formatted = {
				iata: formatForSearch(airport.iata),
				name: formatForSearch(airport.name)
			}
		
			airport.locationData = locations[airport.location];
			airportIATA[airport.formatted.iata] = airport;
			airportIATA[airport          .iata] = airport;
			
			airports.push(airport);
		});

		console.log(tzoffsets);
  } catch (e) { throw e; }
})().catch(e => console.error(e.stack));

module.exports = {
	basic_query,
	formatForSearch,
	locations,
	airports,
	airportIATA,
	tzoffsets
};
//module.exports = { basic_query }

//module.exports

/*
(async () => {
  // note: we don't try/catch this because if connecting throws an exception
  // we don't need to dispose of the client (it will be undefined)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const queryText = 'INSERT INTO users(name) VALUES($1) RETURNING id'
    const res = await client.query(queryText, ['brianc'])
    const insertPhotoText = 'INSERT INTO photos(user_id, photo_url) VALUES ($1, $2)'
    const insertPhotoValues = [res.rows[0].id, 's3.bucket.foo']
    await client.query(insertPhotoText, insertPhotoValues)
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
})().catch(e => console.error(e.stack))*/