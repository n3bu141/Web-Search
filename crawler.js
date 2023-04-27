const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});
const fs = require('fs');

async function getPage(url) {
    const { data } = await axios.get(url);

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

async function getLinks(data, isRobot, isLast, url) {
    const $page = cheerio.load(data);
    const links = new Queue();

    if ($page('meta[name="robots"]:not([content~="noindex"] [content~="nofollow"])').length > 0) {
        $page('a[href^="https"]:not([rel~="nofollow"] [rel~="nofollow,"] [rel~="noindex"] [rel~="noindex,"])').each((i, elem) => {
            links.add(elem.attribs.href);
        })
    }

    if (!isRobot) {
        appendToFile(url, data, isLast)
    }

    return links;
}

async function search(start, numPages) {
    let i = 1;
    let data = await getPage(start);
    let links = await getLinks(data, false, i == numPages, start);

    // console.log(links)

    if (links.length <= 1) {
        return;
    }

    let noVisit = new Set()
    let visitedParent = new Set()

    while (links.length != 0 && i != numPages) {
        const link = links.remove();
        if (!visitedParent.has(parent(link))) {
            const robotslink = robots(start);
            let robotspage;
            let disallowed;
            try {
                robotspage = await getPage(robotslink);
                disallowed = robotspage.split("User-agent: *")[1].split("Disallow");

                for (let j = 0; j < disallowed.length; j++) {
                    if (disallowed[j].charAt(0) === ":") {
                        noVisit.add(parent(start) + disallowed[j].substring(3, disallowed[j].indexOf("\n")));
                    }
                }
            } catch (error) {

            }

            visitedParent.add(parent(link))
        }


        if (!noVisit.has(link)) {
            try {
                i++;
                data = await getPage(link);
                noVisit.add(link)

                console.log(link)
                // console.log(noVisit)
                // console.log(links)
                console.log(i)
                let tempLinks = await getLinks(data, false, i == numPages || links.length == 0, link);
                links.addQueue(tempLinks, noVisit);

                // console.log(tempLinks)
            } catch (e) {
                console.log(e)
                i--;
            }
        }


        await new Promise(r => setTimeout(r, 500));
    }
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

    addQueue(queue, noVisit) {
        for (let i = queue.frontIndex; i < queue.backIndex; i++) {
            const temp = queue.remove()

            if (temp !== undefined && !noVisit.has(temp)) {
                this.add(temp);
            }
        }
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