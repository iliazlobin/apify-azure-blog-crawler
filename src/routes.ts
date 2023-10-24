import Apify, { Actor } from 'apify';
import { createPuppeteerRouter } from 'crawlee';

export const router = createPuppeteerRouter();

router.addDefaultHandler(async ({ page, log, enqueueLinks }) => {
    const url = page.url() ?? '';
    log.info(`processing default page: ${url}`);

    let {
        lookBackWindow = 0,
        paginationLimit = 1,
    } = await Actor.getInput<{
        lookBackWindow?: number,
        paginationLimit?: number
    }>() || {};
    log.debug(`inputs: lookBackWindow=${lookBackWindow}, paginationLimit=${paginationLimit}`);

    log.info(`paginating ${paginationLimit} times`);
    for (let i = 0; i < paginationLimit; i++) {

        const cards = await page.$$eval('article[id]', (els) => els.map(() => ''));
        log.debug(`Number of cards detected: ${cards.length}`);

        try {
            await page.waitForSelector('button[data-load-more-button]', { timeout: 1000 });
            await page.click('button[data-load-more-button]');
        } catch (e) {
            log.error(`error clicking on the "more" button: ${e}`);
            break;
        }
        await new Promise(r => setTimeout(r, 5000));
    }

    log.info(`parsing all cards`);
    const cards = await page.$$eval('article[id]', (els) => {
        const items: any[] = [];

        for (const el of els) {
            const tags: string[] = [];
            el.querySelectorAll('a[rel="category tag"]').forEach((a) => {
                tags.push(a.textContent?.trim() ?? '');
            });
            const date = el.parentNode?.querySelector('time[pubdate]')?.textContent?.trim() ?? '';
            const title = el.parentNode?.querySelector('a[rel="bookmark"]')?.querySelector('span')?.textContent?.trim() ?? '';
            const url = el.parentNode?.querySelector('a[rel="bookmark"]')?.getAttribute('href') ?? '';
            const author = el.parentNode?.querySelector('a[rel="author"]')?.textContent?.trim() ?? '';
            const jobTitle = el.parentNode?.querySelector('a[rel="author"]')?.parentNode?.querySelector('span')?.textContent?.trim() ?? '';
            const description = el.parentNode?.querySelector('div[itemprop="description"]')?.textContent?.trim() ?? '';

            items.push({
                tags,
                date,
                title,
                url,
                author,
                jobTitle,
                description,
            });
        }

        return items;
    });

    const regex = /category\/([^\/]*)/;
    const match = url.match(regex);
    const blog = match ? match[1] : '';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfTodayText = startOfToday.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const targetDate = new Date(startOfToday.getTime() - lookBackWindow * 24 * 60 * 60 * 1000);
    const targetDateText = targetDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

    log.info(`filtering cards: ${targetDateText} - ${startOfTodayText}`);

    const filteredCards: any[] = [];
    for (const card of cards) {
        const date = new Date(card.date);
        const dateText = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        if (date < targetDate) {
            log.debug(`skipping card: (${dateText} < ${targetDateText}): ${card.url} ${card.title}`);
            continue;
        }
        if (!filteredCards.some(c => c.url === card.url)) {
            log.debug(`adding card (${dateText} > ${targetDateText}): ${card.url} ${card.title}`);
            filteredCards.push(card);
        }
    }

    log.info(`enqueuing ${filteredCards.length} cards`);
    for (const card of filteredCards) {
        log.debug(`enqueueing url: ${card.url}, ${card.title}`);

        await enqueueLinks({
            urls: [card.url],
            label: 'article',
            userData: {
                title: card.title,
                author: card.author,
                tags: card.tags,
                date: card.date,
                jobTitle: card.jobTitle,
                description: card.description,
                blog: blog,
                targetDateText: targetDateText,
            },
        });
    }
});

router.addHandler('article', async ({ request, page, log }) => {
    const url = request.loadedUrl ?? '';
    const pageTitle = await page.title();
    const data = request.userData;

    const dateTag = await page.$eval('time[pubdate]', (el) => el.textContent?.trim()) ?? '';
    const date = new Date(dateTag);
    const dateText = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

    log.debug(`parsing page (${dateText}): ${url} ${pageTitle}`);

    const targetDateText = data.targetDateText;
    const targetDate = new Date(targetDateText)

    if (date < targetDate) {
        log.debug(`skipping article: (${dateText} < ${targetDateText}): ${url} ${pageTitle}`);
        return;
    }

    const tags = await page.$eval('header[id="sticky-bar-anchor"]', (el) => {
        const tags: string[] = [];
        el.querySelectorAll('a[rel="category tag"]').forEach((a) => {
            tags.push(a.textContent?.trim() ?? '');
        });
        return tags;
    });

    const title = await page.$eval('header[id="sticky-bar-anchor"]', (el) => el.querySelector('h1')?.textContent?.trim()) ?? '';

    const author = await page.$eval('header[id="sticky-bar-anchor"]', (el) => el.querySelector('a[rel="author"]')?.textContent?.trim()) ?? '';
    const authorJobTitle = await page.$eval('header[id="sticky-bar-anchor"]', (el) => el.querySelector('a[rel="author"]')?.parentNode?.querySelector('span')?.textContent?.trim()) ?? '';

    const text = await page.$eval('div[id="blog-post-content"]', (el) => el.textContent?.trim()) ?? '';

    log.info(`saving page (${dateTag}): ${url} ${title}`);

    await Apify.Dataset.pushData({
        title: title,
        url: url,
        tags: tags,
        date: date,
        author: author,
        authorJobTitle: authorJobTitle,
        blog: data.blog,
        description: data.description,
        text: text,
    });
});
