import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';
import { router } from './routes.js';

await Actor.init();

const proxyConfiguration = await Actor.createProxyConfiguration();

// https://azure.microsoft.com/en-us/blog/
const defaultUrls = [
    'https://azure.microsoft.com/en-us/blog/category/ai-machine-learning/',
    'https://azure.microsoft.com/en-us/blog/category/compute/',
];

const {
    maxRequestsPerMinute = 5,
    maxRequestRetries = 5,
    requestHandlerTimeoutSecs = 600,
    urls = defaultUrls,
} = await Actor.getInput<{
    maxRequestsPerMinute?: number,
    maxRequestRetries?: number,
    requestHandlerTimeoutSecs?: number
    urls?: string[],
}>() || {};

const crawler = new PuppeteerCrawler({
    proxyConfiguration,
    requestHandler: router,
    maxRequestsPerMinute,
    maxRequestRetries,
    requestHandlerTimeoutSecs,
    useSessionPool: false,
    retryOnBlocked: true,
    launchContext: {
        useChrome: true,
        launchOptions: {
            executablePath: '/home/izlobin/apps/chromium/linux-1270032/chrome-linux/chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
    },
});

await crawler.run(urls);

await Actor.exit();
