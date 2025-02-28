import process from 'node:process';
import url from 'node:url';
import fetch from 'node-fetch';
import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import {v5 as uuid} from 'uuid';
import moment from 'moment';
import _ from 'underscore';
import xml from 'xml';
import {XMLBuilder, XMLParser} from 'fast-xml-parser';
import sqlite3 from 'sqlite3';
import nocache from 'nocache';
import bodyParser from 'body-parser';

const app = express();
const port = 5000;
const TAMILMV_URL = process.env.TAMILMV_URL || 'https://www.1tamilmv.tips';
const globalSettings = {
	title: 'TamilMV Proxy Manager', message: 'TamilMV Proxy Manager',
};

app.use(cors());
app.use(nocache());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true,
}));
app.set('view engine', 'pug');
app.set('views', './views');
app.locals.cache = false;

const createTable = error => {
	if (error) {
		console.error(error.message);
	}

	console.log('Connected to the tamilmv manager database.');
	db.run('CREATE TABLE IF NOT EXISTS config (tamilmv_url TEXT, custom_search INT, custom_search_keyword TEXT)', initializeDB);
};

const db = new sqlite3.Database('./database/manager.db', createTable);

const getCount = () => new Promise((resolve, reject) => {
	db.get('SELECT COUNT(*) AS count FROM config', (error, row) => {
		if (error) {
			reject(error);
		} else {
			resolve(row.count);
		}
	});
});

function hasNonEnglishCharacters(string_) {
	// eslint-disable-next-line no-control-regex
	const regex = /[^\u0000-\u007F\dA-Za-z .,\-]+/; // eslint-disable-line no-useless-escape

	return regex.test(string_);
}

const getConfig = () => new Promise((resolve, reject) => {
	db.get('SELECT * FROM config', (error, row) => {
		if (error) {
			reject(error);
		} else {
			resolve({
				...row,
				tamilMvUrl: row.tamilmv_url,
			});
		}
	});
});

const updateConfig = ({
	tamilmvUrl,
	customSearch,
	customSearchKeyword,
}) => new Promise((resolve, reject) => {
	db.run('UPDATE config SET tamilmv_url=?, custom_search=?, custom_search_keyword=?', [tamilmvUrl, customSearch, customSearchKeyword], (error, rows) => {
		if (error) {
			console.debug(rows);
			reject(error);
		} else {
			resolve(true);
		}
	});
});

const updateRedirectUrl = tamilMvUrl => new Promise((resolve, reject) => {
	db.run('UPDATE config SET tamilmv_url=?', [tamilMvUrl], (error, rows) => {
		if (error) {
			console.debug(rows);
			reject(error);
		} else {
			console.log(`[SUCCESS] Updated URL to ${tamilMvUrl}`);
			resolve(true);
		}
	});
});

const initializeDB = async () => {
	const count = await getCount();
	const insertToDB = stmt => new Promise((resolve, reject) => {
		stmt.run(TAMILMV_URL, 0, 'movie', error => {
			if (error) {
				reject(error);
			} else {
				resolve(true);
			}
		});
	});

	if (count === 0) {
		const stmt = db.prepare('INSERT INTO config VALUES (?, ?, ?)');
		const inserted = await insertToDB(stmt);
		if (inserted) {
			await initializeRoutes();
		}
	} else {
		await initializeRoutes();
	}
};

const searchMovies = async keyword => {
	const {tamilMvUrl} = await getConfig();
	console.log('Page:', `${tamilMvUrl}/index.php?/search/&q=${keyword}&quick=1`);
	const grabToken = await fetch(`${tamilMvUrl}/index.php?/search/&q=${keyword}&quick=1`, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/110.0',
			Accept: '*/*',
			'Accept-Language': 'en-US,en;q=0.5',
			'Accept-Encoding': 'gzip, deflate, br',
			Referer: `${tamilMvUrl}/index.php?/search/&q=${keyword}&quick=1`,
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

	const grabResults = await fetch(`${tamilMvUrl}/index.php?/search/&q=${keyword}&search_and_or=or&sortby=relevancy&csrfKey=${csrfKey}`, {
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
		referrer: `${tamilMvUrl}/index.php?/search/&q=${keyword}&search_and_or=or&sortby=relevancy`,
		method: 'GET',
		mode: 'cors',
	});
	const searchResultsJson = await grabResults?.json();
	if (searchResultsJson?.redirect) {
		const redirectBaseUrl = url.parse(searchResultsJson?.redirect);
		const newRedirectUrl = `${redirectBaseUrl.protocol}//${redirectBaseUrl.hostname}`;
		await updateRedirectUrl(newRedirectUrl);
		console.error(`Update URL to ${newRedirectUrl}`);
	}

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

const getSize = filename => {
	const sizeString = filename.match(/(\d+(\.\d+)?)\s*(gb|mb)/i)?.[0];
	if (!sizeString) {
		return null;
	}

	const sizeNumber = Number.parseFloat(sizeString);
	const sizeUnit = sizeString.slice(-2).toUpperCase();
	const sizeBytes = sizeUnit === 'GB' ? sizeNumber * 1024 * 1024 * 1024 : sizeNumber * 1024 * 1024;
	return sizeBytes;
};

const getMagnetLinks = async (topicUrl, keyword) => {
	const {tamilMvUrl} = await getConfig();
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
		referrer: `${tamilMvUrl}/index.php?/search/&q=${keyword}&quick=1&type=forums_topic`,
		method: 'GET',
		mode: 'cors',
	});
	const forumTopic = await topicBody.text();
	const publishedDate = forumTopic.match('"dateModified": "(.+)"')?.[1];
	const $ = cheerio.load(forumTopic);
	const torrentNames = [];
	$('[data-fileext="torrent"]').each((index, value) => {
		const torrentName = $(value).text();
		const torrentFile = $(value).attr('href');
		torrentNames.push({
			name: torrentName,
			file: torrentFile,
		});
	});
	const magnetLinks = [];
	const aElements = $('a').get();
	for (let k = 0, i = 0; k < aElements.length; k++) {
		const magnetLink = $(aElements[k]).attr('href');
		if (magnetLink && magnetLink.startsWith('magnet:')) {
			const torrentInfo = getSize(torrentNames[i]?.name?.replace('.torrent', ''));
			const torrentSize = (torrentInfo) || 1000;

			magnetLinks.push({
				name: torrentNames[i]?.name?.replace('.torrent', ''),
				torrentPath: torrentNames[i]?.file,
				guid: uuid(torrentNames[i]?.name?.replace('.torrent'), '4d1d290e-e395-4ba3-9ef4-ec90def49826'),
				magnet: magnetLink,
				publishedDate: moment(publishedDate).utc().format('ddd, DD MMM YYYY HH:mm:ss ZZ'),
				torrentSize,
			});
			i++;
		}
	}

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

const createRssFeed = async (baseUrl, magnetInfo, request) => {
	const feedObject = {
		rss: [
			{
				_attr: {
					version: '2.0',
					'xmlns:atom': 'http://www.w3.org/2005/Atom',
					'xmlns:torznab': 'http://torznab.com/schemas/2015/feed',
				},
			},
			{
				channel: [
					{
						'atom:link': {
							_attr: {
								href: baseUrl,
								rel: 'self',
								type: 'application/rss+xml',
							},
						},
					},

					{
						title: 'TamilMV RSS',
					},

					{
						link: baseUrl,
					},
					{description: 'TamilMV RSS Generator Developed By Febin Baiju'},
					{'torznab:response':
								{_attr: {
									offset: request.offset >= 50 ? 0 : 0,
									total: request.offset >= 50 ? 0 : 1,
								},
								},
					},
					(request?.offset < 50 ? {
						language: 'en-US',
					} : {}),
					(request?.offset < 50 ? {
						category: 2000,
					} : {}),
					...(request?.offset < 50 ? magnetInfo.map(post => {
						const feedItem = {
							item: [
								{title: post.name},
								{
									description: {
										_cdata: post.name,
									},
								},
								{
									link: post.torrentPath,
								},
								{
									guid: post.guid,

								},
								{
									pubDate: post.publishedDate,
								},
								{
									enclosure: {_attr: {url: post.torrentPath, type: 'application/x-bittorrent', length: '10000'}},
								},
								{comments: post.name},

								// {'torznab:attr':{_attr:{name: 'magneturl'		, value:torrent.link}}},
								{'torznab:attr': {_attr: {name: 'seeders', value: 10}}},
								{'torznab:attr': {_attr: {name: 'leechers', value: 10}}},
								{'torznab:attr': {_attr: {name: 'size', value: post.torrentSize}}},
							],
						};
						return feedItem;
					}) : {}),
				],
			},
		],
	};
	return feedObject;
};

const torznabTest = async () => {
	const xmlString = {
		caps:
			[
				{server: {_attr: {version: '1.0', title: 'TamilMV Torznab', image: 'https://download.epson-europe.com/logo/true_epsonlogo.jpg'}}},
				{limits: {_attr: {max: '100', default: 50}}},
				{registration: {_attr: {available: 'no', open: 'no'}}},
				{searching: [
					{search: {_attr: {available: 'yes'}}},
					{'movie-search': {_attr: {available: 'yes', supportedParams: 'q'}}},
				]},
				{categories: []},
			],
	};

	const categoriesXml = xmlString.caps[_.findIndex(xmlString.caps, 'categories')].categories;
	for (const category of [{
		pid: 0,
		id: 2000,
		name: 'Movies',
	}]) {
		if (category.pid === 0) {
			categoriesXml.push({category: [
				{_attr: {id: category.id, name: category.name}},
			],
			});
		} else {
			_.find(categoriesXml, object => _.some(object.category, objc => objc._attr !== undefined && objc._attr.id === category.pid) !== undefined).category.push(
				{subcat: [
					{_attr: {id: category.id, name: category.name}},
				],
				});
		}
	}

	return xmlString;
};

const noTopics = async baseUrl => {
	const feedObject = {
		rss: [
			{
				_attr: {
					version: '2.0',
					'xmlns:atom': 'http://www.w3.org/2005/Atom',
					'xmlns:torznab': 'http://torznab.com/schemas/2015/feed',
				},
			},
			{
				channel: [
					{
						'atom:link': {
							_attr: {
								href: baseUrl,
								rel: 'self',
								type: 'application/rss+xml',
							},
						},
					},

					{
						title: 'TamilMV RSS',
					},

					{
						link: baseUrl,
					},
					{description: 'TamilMV RSS Generator Developed By Febin Baiju'},
					{'torznab:response':
								{_attr: {
									offset: 0,
									total: 0,
								},
								},
					},
				],
			},
		],
	};
	return feedObject;
};

const processKeyword = key => {
	const searchKey = (key)?.toString()?.trim()?.split(' ')?.[0] || '';
	if (searchKey) {
		return encodeURIComponent(searchKey);
	}

	return '';
};

async function initializeRoutes() {
	app.get('/', async (request, response) => {
		const loadSettings = await getConfig();
		// eslint-disable-next-line no-extra-boolean-cast
		const settings = {...loadSettings, customSearch: Boolean(loadSettings.custom_search), customSearchOn: Boolean(loadSettings.custom_search), customSearchOff: !Boolean(loadSettings.custom_search)};
		const tryUrl = `${loadSettings.tamilMvUrl}/index.php?/search/&q=${encodeURIComponent(loadSettings.custom_search_keyword)}&quick=1`;

		response.render('index', {...globalSettings, tryUrl, ...settings});
	});

	app.post('/', async (request, response) => {
		const previousConfig = await getConfig();
		const updateSettings = await updateConfig({
			tamilmvUrl: request.body.tamilmv_url || previousConfig.tamilmv_url,
			customSearch: request.body.custom_search_toggle === '1',
			customSearchKeyword: request.body.custom_search || previousConfig.custom_search_keyword,
		});
		const loadSettings = await getConfig();
		// eslint-disable-next-line no-extra-boolean-cast
		const settings = {...loadSettings, customSearch: Boolean(loadSettings.custom_search), customSearchOn: Boolean(loadSettings.custom_search), customSearchOff: !Boolean(loadSettings.custom_search), ...(updateSettings ? {
			savedMessage: 'Settings Saved!',
		} : null)};
		const tryUrl = `${loadSettings.tamilMvUrl}/index.php?/search/&q=${encodeURIComponent(loadSettings.custom_search_keyword)}&quick=1`;

		response.render('index', {...globalSettings, tryUrl, ...settings});
	});

	app.get('/api', async (request, response) => {
		const {tamilMvUrl, ...configs} = await getConfig();
		console.log('query', request.query);
		const baseUrl = request.protocol + '://' + request.get('host');
		const testMode = request.query.t === 'caps';
		const keyword = !testMode && configs.custom_search ? encodeURIComponent(configs.custom_search_keyword) : processKeyword(request.query.q) || 'nanpakal';
		console.log('Keyword:', keyword);

		let rssFeed;
		try {
			const body = await searchMovies(keyword);
			if (body) {
				try {
					if (testMode) {
						rssFeed = await torznabTest();
					} else if (request.query.offset >= 50) {
						rssFeed = await noTopics(baseUrl);
					} else if (configs.custom_search && hasNonEnglishCharacters(request.query.q)) {
						rssFeed = await noTopics(baseUrl);
					} else {
						const topics = await getAllTopics(body);
						// eslint-disable-next-line max-depth
						if (topics.length > 0) {
							const magnetInfo = await scrapTorrents(topics, keyword);
							rssFeed = magnetInfo.length > 0 ? await createRssFeed(baseUrl, magnetInfo, request.query) : await noTopics(baseUrl);
						} else {
							rssFeed = await noTopics(baseUrl);
						}
					}
				} catch {
					console.error('Error fetching topics');
					return response.status(529).json({
						message: 'Could not get topics',
						status: 'FAILED',
					});
				}
			} else {
				console.log('Possible Token Error');
			}
		} catch {
			console.error(`Error connecting to ${tamilMvUrl}`);
			return response.status(521).json({
				message: `Could not connect to the server ${tamilMvUrl}`,
				status: 'FAILED',
			});
		}

		const parser = new XMLParser({
			ignoreAttributes: false,
			preserveOrder: true,
			cdataPropName: '__cdata',
		});

		const feed = `<?xml version="1.0" encoding="UTF-8" ?>${xml(rssFeed)}`;
		const builder = new XMLBuilder({
			ignoreAttributes: false,
			preserveOrder: true,
			cdataPropName: '__cdata',
			format: true,
		});
		const xmlContent = builder.build(parser.parse(feed));

		response.contentType('Content-Type', 'text/xml');
		return response.send(xmlContent);
	});
}

app.listen(port, error => {
	if (error) {
		db?.close();
		console.log('Error while starting server', 'at', port);
	} else {
		console.log('Server has been started', 'at port', port);
	}
});
