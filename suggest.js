// Airport Search Module
//		holds all functions and variables related to performing airport searches

const db = require('./db.js');

const locations = db.locations;
const formatForSearch = db.formatForSearch;
const airports = db.airports;
const airportIATA = db.airportIATA;

// maximum number of search results to show
const RESULT_LIMIT = 10;

// stores data based on location fields
// priority:
// 		fields will be tested for a match according to their priority (lower priority is better)
// 		priority is partitioned based how far the query length is from 3 because of airport IATA codes (3 letters)
// 		(query.length < 3) => priority[0]
// 		(query.length = 3) => priority[1]
// 		(query.length > 3) => priority[2]
// display: is an airport is identified by a location field and is not grouped with other results, 
//		it will be rendered on the client according to the display code
const locationFields = {
	city:    { priority: [1, 2, 1], display: "A" },
	iata:    { priority: [5, 1, 5], display: "C" },
	name:    { priority: [2, 3, 2], display: "C" },
	state:   { priority: [3, 4, 3], display: "A" },
	country: { priority: [4, 5, 4], display: "A" }
};

// add airport to search results object
const addAirportToResults = (results, field, options, airport, i) => {
	const result = {
		iata: airport.iata,
		name: airport.name,
		location: airport.locationData.full,
		display: locationFields[field].display,
		matchedField: field,
	};

	options.splice(i, 1); // delete the match from the array of options 

	let resultLocation = results[airport.location]; 
	if (!resultLocation) { // add the city the airport is in to the results index if it doesnt exist
		resultLocation = [];
		results[airport.location] = resultLocation;
	}

	resultLocation.push(result); // add the airport to the results
};

// populate search results object based on the location field
//		results = results object
//		key 		= location field
//		qFormat = formatted query
//		options = unmatched airports
//		max			= max number of airports allowed to add to results
const populateKeyResults = (results, key, qFormat, options, max) => {
	
	if (!max) return 0;

	switch (key) {
		case "city":
		case "state":
		case "country":
			for (let i = options.length - 1; i >= 0; i--) {
				let airport = options[i];
				let compare = airport.locationData.formatted[key]; // find formatted value of the key
				
				if ( // add it to the results if it matches
					compare && compare.startsWith(qFormat) || 
					airport.locationData.formatted.full.startsWith(qFormat)) 
				{
					addAirportToResults(
						results, key, options, airport, i,
						airport.locationData[key], compare);
					if (max === 1) return 0; else max--;
				}
			}

			break;
		case "name":
			for (let i = options.length - 1; i >= 0; i--) {
				let airport = options[i];
				if (airport.formatted.name.startsWith(qFormat)) { // if the formatted name matches then add it
					addAirportToResults(
						results, key, options, airport, i,
						airport.name, airport.formatted.name);
					if (max === 1) return 0; else max--;
				}
			}
			
			break;
		case "iata":
			if (qFormat.length > 3) return max; // query length greater than 3 means no iata matches

			if (qFormat.length === 3) { // if query length is exactly 3 then we just need to search the index
				let airport = null;
				let index = 0;
				if (!airportIATA[qFormat]) return max;
	
				for (let i = options.length - 1; i >= 0; i--) {
					let option = options[i];
					if (option.formatted.iata === qFormat) {
						airport = option;
						index = 1;
						break;
					}
				}
	
				if (!airport) return max;
				
				addAirportToResults(
					results, key, options, airport, index,
					airport.iata, qFormat);
				if (max === 1) return 0; else max--;
			} else { // otherwise we need to find potential matches
				for (let i = options.length - 1; i >= 0; i--) {
					let airport = options[i];
					if (airport.formatted.iata.startsWith(qFormat)) {
						addAirportToResults(
							results, key, options, airport, i,
							airport.iata, airport.formatted.iata);
						if (max === 1) return 0; else max--;
					}
				}
			}
			break;
	}

	return max;
};

const suggest = query => {
	let qFormat = formatForSearch(query);
	let qLen = qFormat.length;

	let results = {};

	let locationKeys  = Object.keys(locationFields);
	let priorityIndex = qLen < 3 ? 0 : qLen > 3 ? 2 : 1;
	let airportOptions = airports.slice(0);

	// sort location keys by priority according to the length of our query
	locationKeys.sort((a, b) => 
		locationFields[a].priority[priorityIndex] - 
		locationFields[b].priority[priorityIndex]);
	
	let resultsLeft = RESULT_LIMIT;

	// for each key we try to populate our results with a search by this key
	for (let i = 0; i < locationKeys.length; i++) {
		resultsLeft = populateKeyResults(results, locationKeys[i], qFormat, airportOptions, resultsLeft);
		if (!resultsLeft) break;
	}

	// priority of each city (based on the lowest priority of the airport within the city)
	let cityPriority = {};
	let cities = Object.keys(results);
	
	
	cities.forEach(city => {
		let airportResults = results[city];
		let minPriority = 100;

		// for each city's result, sort by priority first, alphabetic order second
		airportResults.sort((a, b) => {
			let priorityDiff = 
				locationFields[a.matchedField].priority[priorityIndex] - 
				locationFields[b.matchedField].priority[priorityIndex];
			
			if (priorityDiff) 
				return priorityDiff;
			else
				return airportIATA[a.iata].formatted.name.localeCompare(
					     airportIATA[b.iata].formatted.name);
		});

		// calculate the city's priority as the lowest among its results
		airportResults.forEach(airport => minPriority = Math.min(
			minPriority, 
			locationFields[airport.matchedField].priority[priorityIndex]));
		
		cityPriority[city] = minPriority;
	});

	// sort cities by their priorities
	cities.sort((a, b) => cityPriority[a] - cityPriority[b]);

	let suggestions = [];

	// build the suggestions array
	cities.forEach(city => {
		let cityResults = results[city];
		let isMulti = cityResults.length > 1;

		let section = {
			location: locations[city].full,
			suggestions: cityResults
		};

		// if the city contains more than one result, use the B display format
		if (isMulti) cityResults.forEach(result => result.display = "B");

		suggestions.push(section);
	});

	// return the suggestions array
	return suggestions;
}

/* =====================
   ====== EXPORTS ======
	 ===================== */

module.exports = suggest