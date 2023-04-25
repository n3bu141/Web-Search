const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});
const fs = require('fs');

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

    visitedParent.add(await parent(start))

    for (let j = links.frontIndex; j < links.backIndex; j++) {
        noVisit.add(links.atIndex(j))
    }

    while (links.length != 0 && i != numPages) {
        const link = links.remove();
        if (!visitedParent.has(await parent(link))) {
            const robotslink = await robots(start);
            let robotspage;
            try {
                robotspage = await getPage(robotslink, true, false);
            } catch (error) {
                continue;
            }
            const disallowed = robotspage.split("User-agent: *")[1].split("Disallow");
            for (let j = 0; j < disallowed.length; j++) {
                if (disallowed[j].charAt(0) === ":") {
                    noVisit.add(await parent(start) + disallowed[j].substring(3, disallowed[j].indexOf("\n")));
                }
            }

            visitedParent.add(await parent(link))
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
        console.log(links.length + ' ' + i)

        await new Promise(r => setTimeout(r, 400));
    }

    return;
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
        fs.appendFileSync('crawled.json', '[\n');
        console.log(link)
        await search(link, num);
        fs.appendFileSync('crawled.json', '\n]');

        readline.close();
    })
})