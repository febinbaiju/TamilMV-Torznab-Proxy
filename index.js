import fetch from 'node-fetch';
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as cheerio from 'cheerio';

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

const getMagnetLinks = async (topicUrl, keyword) => {
	console.log('fetching:', topicUrl);
	const topicBody = await fetch(topicUrl, {
		credentials: 'include',
		headers: {
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0',
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			'Upgrade-Insecure-Requests': '1',
			'Sec-Fetch-Dest': 'document',
			'Sec-Fetch-Mode': 'navigate',
			'Sec-Fetch-Site': 'same-origin',
			'Sec-Fetch-User': '?1',
			'Proxy-Authorization': 'Basic ZDc5YW1ibmktZ3A4ZHkyczozOWpkeXFtOHVu',
		},
		referrer: `${TAMILMV_URL}/index.php?/search/&q=${keyword}&quick=1&type=forums_topic`,
		method: 'GET',
		mode: 'cors',
	});
	const forumTopic = await topicBody.text();
	const $ = await cheerio.load(forumTopic);
	const torrentNames = [];
	$('[data-fileext="torrent"]').each((index, value) => {
		const torrentName = $(value).text();
		const torrentFile = $(value).attr('href')
		torrentNames.push({
			name: torrentName,
			file: torrentFile
		});
	});
	const magnetLinks = [];
	let i = 0;
	$('a').each((index, value) => {
		const magnetLink = $(value).attr('href');
		if (magnetLink && magnetLink.startsWith('magnet:')) {
			magnetLinks.push({
				name: torrentNames[i]?.name?.replace('.torrent', ''),
				torrentPath: torrentNames[i]?.file,
				magnet: magnetLink,
			});
			i++;
		}
	});

	return magnetLinks;
};

const scrapTorrents = async (topics, keyword) => {
	const torrentCollection = [];
	for (let i = 0; i <= topics.length; i++) {
		if (topics[i]?.url) {
			const topicTorrent = await getMagnetLinks(topics[i]?.url, keyword); // eslint-disable-line no-await-in-loop
			torrentCollection.push(topicTorrent);
		}
	}

	return torrentCollection.flat(1);
};

app.get('/', async (request, response) => {
	const keyword = 'nanpakal';
	try {
		const body = await searchMovies(keyword);
		if (body) {
			try {
				const topics = await getAllTopics(body);
				return response.send(await scrapTorrents(topics, keyword));
			} catch {
				console.error('Error fetching topics');
				return response.sendStatus(529).json({
					message: 'Could not get topics',
					status: 'FAILED',
				});
			}
		}
	} catch {
		console.error(`Error connecting to ${TAMILMV_URL}`);
		return response.sendStatus(521).json({
			message: `Could not connect to the server ${TAMILMV_URL}`,
			status: 'FAILED',
		});
	}
});

app.listen(port, error => {
	if (error) {
		console.log('Error while starting server...');
	} else {
		console.log('Server has been started at port', port);
	}
});
