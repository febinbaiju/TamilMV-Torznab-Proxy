import fetch from 'node-fetch';
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const port = 8000;
const TAMILMV_URL = 'https://www.1tamilmv.wtf';

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());

const searchMovies = async keyword => {
	const grabToken = await fetch(`${TAMILMV_URL}/index.php?/search/&q=${keyword}&quick=1`, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0',
			Accept: '*/*',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, br',
			Referer: `${TAMILMV_URL}/index.php?/search/&q=${keyword}&quick=1`,
			'X-Requested-With': 'XMLHttpRequest',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-origin',
			'Proxy-Authorization': 'Basic ZDc5YW1ibmktZ3A4ZHkyczozOWpkeXFtOHVu',
			Connection: 'keep-alive',
			Cookie: 'ips4_IPSSessionFront=7ucol8i831sd8pbvcpsnn8h8sb; ips4_ipsTimezone=Asia/Kolkata; ips4_hasJS=true',
			TE: 'trailers',
		},
	});
	const tokenResult = await grabToken.json();
	const csrfKey = (tokenResult).filters?.toString()?.match('<input type="hidden" name="csrfKey" value="(.+)">')?.[1] || '';

	const grabResults = await fetch(`${TAMILMV_URL}/index.php?/search/&q=${keyword}&search_and_or=or&sortby=relevancy&csrfKey=${csrfKey}`, {
		credentials: 'include',
		headers: {
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0',
			Accept: '*/*',
			'Accept-Language': 'en-US,en;q=0.5',
			'X-Requested-With': 'XMLHttpRequest',
			'Sec-Fetch-Dest': 'empty',
			'Sec-Fetch-Mode': 'cors',
			'Sec-Fetch-Site': 'same-origin',
			'Proxy-Authorization': 'Basic ZDc5YW1ibmktZ3A4ZHkyczozOWpkeXFtOHVu',
		},
		referrer: `${TAMILMV_URL}/index.php?/search/&q=${keyword}&search_and_or=or&sortby=relevancy`,
		method: 'GET',
		mode: 'cors',
	});
	const searchResultsJson = await grabResults?.json();
	return (searchResultsJson)?.content || '';
};

const getAllTopics = async content => {
	const topicResults = content.matchAll(/<a href='(.+)' data-linkType="link" data-searchable>(.+)<\/a>/g);
	const iterResults = [...topicResults];
	const finalTopics = [];
	for (const match of iterResults) {
		const [, g1, g2] = match;
		finalTopics.push({
			url: g1,
			title: g2,
		});
	}

	return finalTopics;
};

app.get('/', async (request, response) => {
	const body = await searchMovies('sagar');
	const topics = await getAllTopics(body);
	response.send(body);
});

app.listen(port, error => {
	if (error) {
		console.log('Error while starting server...');
	} else {
		console.log('Server has been started at port', port);
	}
});
