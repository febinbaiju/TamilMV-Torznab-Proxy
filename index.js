import fetch from 'node-fetch';
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const port = 8000;

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());

const searchMovies = async keyword => {
	const f = await fetch(`https://www.1tamilmv.wtf/index.php?/search/&q=${keyword}&quick=1`, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0',
			Accept: '*/*',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, br',
			Referer: `https://www.1tamilmv.wtf/index.php?/search/&q=${keyword}&quick=1`,
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
	const jsonBody = f.json();
	const csrfKey = (await jsonBody).filters?.toString()?.match('<input type="hidden" name="csrfKey" value="(.+)">')?.[1] || '';

	const grabResults = await fetch(`https://www.1tamilmv.wtf/index.php?/search/&q=${keyword}&search_and_or=or&sortby=relevancy&csrfKey=${csrfKey}`, {
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
		referrer: 'https://www.1tamilmv.wtf/index.php?/search/&q=${keyword}&search_and_or=or&sortby=relevancy',
		method: 'GET',
		mode: 'cors',
	});
	return (await grabResults.json())?.content || ""
};

app.get('/', async (request, res) => {
	const body = await searchMovies('nanpakal');
	res.send(body);
});

app.listen(port, error => {
	if (error) {
		console.log('Error while starting server...');
	} else {
		console.log('Server has been started at port', port);
	}
});
