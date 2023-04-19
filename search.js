const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});
const fs = require('fs');

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

async function getPage(url, isRobot, isLast) {
    const { data } = await axios.get(url);
    if (!isRobot) {
        appendToFile(url, data, isLast)
    }
    return data;
}

function appendToFile(url, HTML, isLast) {
    const currentDate = new Date();

    const data = {
        URL: url,
        Date: currentDate.toISOString(),
        Contents: HTML
    };

    const jsonData = JSON.stringify(data);

    if (isLast) {
        fs.appendFileSync('crawled.json', jsonData);
    } else {
        fs.appendFileSync('crawled.json', jsonData + ',\n');
    }
}

function robots(url) {
    return parent(url) + 'robots.txt';
}

function parent(url) {
    const arr = url.split('/');
    return 'https://' + arr[2] + '/';
}

async function getLinks(data) {
    const $page = cheerio.load(data);
    const links = new Queue();

    if ($page('meta[name="robots"]:not([content~="noindex"] [content~="nofollow"])').length > 0) {
        $page('a[href^="https"]:not([rel~="nofollow"] [rel~="nofollow,"] [rel~="noindex"] [rel~="noindex,"])').each((i, elem) => {
            links.add(elem.attribs.href);
        })
    }

    return links;
}

async function search(start, numPages) {
    let i = 1;
    let data = await getPage(start, false, i == numPages);
    let links = await getLinks(data);

    let noVisit = new Set([start])
    let visitedParent = new Set()

    visitedParent.add(parent(start))

    for (let j = links.frontIndex; j < links.backIndex; j++) {
        noVisit.add(links.atIndex(j))
    }

    while (links.length != 0 && i != numPages) {
        const link = links.remove();
        if (!visitedParent.has(parent(link))) {
            const robotslink = robots(start);
            try {
                const robotspage = await getPage(robotslink, true, false);
            } catch (error) {

            }
            const disallowed = robotspage.split("User-agent: *")[1].split("Disallow");
            for (let i = 0; i < disallowed.length; i++) {
                if (disallowed[i].charAt(0) === ":") {
                    noVisit.add(parent(start) + disallowed[i].substring(3, disallowed[i].indexOf("\n")));
                }
            }
        }

        noVisit.add(link)
        i++;

        try {
            data = await getPage(link, false, i == numPages);
        } catch (e) {
            continue;
        }

        let tempLinks = await getLinks(data);
        noVisit = links.addQueue(tempLinks, noVisit);
        console.log(link)

        await new Promise(r => setTimeout(r, 1200));
    }

    return;
}

async function score(s) {
    const data = JSON.parse(fs.readFileSync("crawled.json"));
    let searched = [];
    for (let i = 0; i < data.length; i++) {
        const scoreReturn = await scoreHTML(data[i]["Contents"], s.toLowerCase());
        searched.push({ URL: data[i]["URL"], Title: scoreReturn[1], Score: scoreReturn[0] })
    }
    console.log(searched);
}

class Queue {
    constructor() {
        this.items = {}
        this.frontIndex = 0
        this.backIndex = 0
    }

    add(item) {
        this.items[this.backIndex] = item
        this.backIndex++
        return item
    }

    remove() {
        const item = this.items[this.frontIndex]
        delete this.items[this.frontIndex]
        this.frontIndex++
        return item
    }

    addQueue(queue, visited) {
        for (let i = queue.frontIndex; i < queue.backIndex; i++) {
            const temp = queue.remove()

            if (!visited.has(temp) && temp !== undefined) {
                this.add(temp);
            }
            visited.add(temp);
        }
        return visited;
    }

    peek() {
        return this.items[this.frontIndex]
    }

    atIndex(index) {
        return this.items[index];
    }

    get length() {
        return this.backIndex - this.frontIndex;
    }

    get printQueue() {
        return this.items;
    }
}

readline.question('Starting link: ', async link => {
    readline.question('Number of pages: ', async num => {
        readline.question('Search term: ', async s => {
            // fs.appendFileSync('crawled.json', '[');
            // console.log(link)
            // await search(link, num);
            // fs.appendFileSync('crawled.json', ']');

            score(s)
            readline.close();
        })
    })
})