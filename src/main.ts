import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';
import { router } from './routes.js';

await Actor.init();

const proxyConfiguration = await Actor.createProxyConfiguration();

// https://azure.microsoft.com/en-us/blog/
// const defaultUrls = [
//     // 'https://azure.microsoft.com/en-us/blog/category/developer-tools/',
//     'https://azure.microsoft.com/en-us/blog/category/devops/',
// ];
const defaultUrls = [
    "https://azure.microsoft.com/en-us/blog/category/ai-machine-learning/",
    "https://azure.microsoft.com/en-us/blog/category/analytics/",
    "https://azure.microsoft.com/en-us/blog/category/compute/",
    "https://azure.microsoft.com/en-us/blog/category/containers/",
    "https://azure.microsoft.com/en-us/blog/category/databases/",
    "https://azure.microsoft.com/en-us/blog/category/developer-tools/",
    "https://azure.microsoft.com/en-us/blog/category/devops/",
    "https://azure.microsoft.com/en-us/blog/category/hybrid-multicloud/",
    "https://azure.microsoft.com/en-us/blog/category/identity/",
    "https://azure.microsoft.com/en-us/blog/category/internet-of-things/",
    "https://azure.microsoft.com/en-us/blog/category/management-and-governance/",
    "https://azure.microsoft.com/en-us/blog/category/migration/",
    "https://azure.microsoft.com/en-us/blog/category/mobile/",
    "https://azure.microsoft.com/en-us/blog/category/networking/",
    "https://azure.microsoft.com/en-us/blog/category/security/",
    "https://azure.microsoft.com/en-us/blog/category/serverless/",
    "https://azure.microsoft.com/en-us/blog/category/storage/",
    "https://azure.microsoft.com/en-us/blog/category/web/"
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
            executablePath: '/root/apps/chromium/linux-1211267/chrome-linux/chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
    },
});

await crawler.run(urls);

await Actor.exit();
