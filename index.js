const moment = require('moment-timezone')
const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const axios = require('axios')
const db    = require('./db.js');

const suggest = require('./suggest.js');

const app = express();

const PORT = 4000;

const airportIATA = db.airportIATA;
const tzoffsets = db.tzoffsets;

app.use(express.json())
app.use(morgan('dev'))
app.use(cors())

app.get('/', (req, res) => {
	res.json({success: true})
})

app.get('/api/suggest', (req, res) => {
	const query = req.query.q;
	if (query) {
		res.json({ suggestions: suggest(query) });
	} else {
		res.json({ result: []});
	}
});

app.get('/api/search', (req, res) => {

	// 16 or 24 character length queries only
	let q = req.query.q;
	if (!q || (q.length !== 16 && q.length !== 24)) {
		res.json({flights: []});
		return;
	};

	// TODO: add type checking
	let codea = q.substring(0, 3);
	let codeb = q.substring(3, 6);
	let datea = q.substring(6, 8) + "-" + q.substring(8, 10) + "-" + q.substring(10, 14);
	let round = q.substring(14, 15);
	let first = q.substring(15, 16);
	let dateb;

	if (!airportIATA[codea] || !airportIATA[codeb]) {
		res.json({flights: []});
		return;
	}

	let sort = req.query.sort ? parseInt(req.query.sort) : 0;
	if (sort !== 0 && sort !== 1 && sort !== 2) sort = 0;

	let limit = req.query.limit ? parseInt(req.query.limit) : 30;
	if (limit > 30 || limit < 1) limit = 30;

	if (q.length == 24) dateb = q.substring(16, 18) + "-" + q.substring(18, 20) + "-" + q.substring(20, 24);

	console.log(codea);
	console.log(codeb);
	console.log(new Date(datea));
	console.log(new Date(dateb));
	console.log(round === "1");
	console.log(first === "1");
	console.log(sort);
	console.log(limit);

	console.log(new Date(datea).getTimezoneOffset());



	console.log(airportIATA[codea].locationData.timecode);
	console.log(q.substring(6, 8) + "-" + q.substring(8, 10) + "-" + q.substring(10, 14))

	let depart_utc_seconds = -tzoffsets[airportIATA[codea].locationData.timecode]*60 % 86400;
	let depart_utc_date    = moment.tz(
		q.substring(10, 14) + "-" + q.substring(6, 8) + "-" + q.substring(8, 10) + " 00:00", 
		airportIATA[codea].locationData.timecode
	).tz('UTC').format("YYYY-MM-DD");

	console.log(depart_utc_date);
	console.log(depart_utc_seconds);
	
	res.json({
		airport_a: codea,
		airport_b: codeb,
		depart: new Date(datea),
		depart_return: new Date(dateb),
		is_roundtrip: round === "1",
		is_firstclass: first === "1",
		sort: sort, 
		limit: limit
	});

	//http://localhost:4000/api/search?q=ordlos120120191112302019
});

app.listen(PORT, () => {
	console.log('Listening on port ' + PORT)
});