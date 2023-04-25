const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3001;

function validateKey(req, res, next) {
    const expectedKey = 'key';
    const actualKey = req.query.key;
    if (actualKey !== expectedKey) {
        res.status(403).json({ error: 'invalid key' });
    } else {
        next();
    }
}

app.get('/search', validateKey, async (req, res) => {
    const s = req.query.s;
    let count = req.query.count;

    if (count == null) {
        count = 10;
    }

    const data = fs.readFileSync('crawled.json');
    const entries = JSON.parse(data);

    const scores = [];

    await entries.forEach(async entry => {
        const start = Date.now();
        const scoreReturn = await scoreHTML(entry["Contents"], s.toLowerCase());
        const score = scoreReturn[0];
        const title = scoreReturn[1]
        scores.push({ Title: title, URL: entry["URL"], Score: score });
        const end = Date.now();
        console.log(`Execution time: ${end - start} ms`);
    });

    scores.sort((a, b) => b['Score'] - a['Score']);
    const topScores = scores.slice(0, count);
    console.log(scores)

    let ret = {"results": topScores.length, "keyword": s, "pages": topScores}

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(ret, null, 4));
});

app.get('/', (req, res) => {
    res.send('Server listening at http://localhost:' + port)
})

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

async function scoreHTML(str, key) {
    const $ = cheerio.load(str);
    let score = 0;

    const title = $('title').text();

    $('title').each((i, elem) => {
        const text = $(elem).text().toLowerCase();
        score += (text.match(new RegExp(key, "g")) || []).length * 10
    })

    $('h1').each((i, elem) => {
        const text = $(elem).text().toLowerCase();
        score += (text.match(new RegExp(key, "g")) || []).length * 5
    })

    $('h2').each((i, elem) => {
        const text = $(elem).text().toLowerCase();
        score += (text.match(new RegExp(key, "g")) || []).length * 4
    })

    $('h3, h4, h5').each((i, elem) => {
        const text = $(elem).text().toLowerCase();
        score += (text.match(new RegExp(key, "g")) || []).length * 3
    })

    $('b, strong, i, em').each((i, elem) => {
        const text = $(elem).text().toLowerCase();
        score += (text.match(new RegExp(key, "g")) || []).length * 2
    })

    $('a[href!=""]').each((i, elem) => {
        const text = $(elem).text().toLowerCase();
        score += (text.match(new RegExp(key, "g")) || []).length * 2
    })

    $('p').each((i, elem) => {
        const text = $(elem).text().toLowerCase();
        score += (text.match(new RegExp(key, "g")) || []).length * 1
    })

    return [score, title];
}