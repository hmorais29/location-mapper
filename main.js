import { CheerioCrawler, Dataset, KeyValueStore } from 'crawlee';

const startUrl = 'https://www.imovirtual.com/comprar/apartamento/';

async function extractLinks($, selector) {
    const links = [];
    $(selector).each((_, el) => {
        const href = $(el).attr('href');
        const name = $(el).text().trim();
        if (href && name) {
            links.push({
                name,
                url: new URL(href, startUrl).toString(),
            });
        }
    });
    return links;
}

async function run() {
    const locations = {};

    const crawler = new CheerioCrawler({
        async requestHandler({ request, $, enqueueLinks, log }) {
            if (request.userData.type === 'START') {
                log.info('📍 A extrair distritos...');
                const districts = await extractLinks($, 'a[href*="/comprar/apartamento/"]'); 
                for (const d of districts) {
                    locations[d.name] = {};
                    await crawler.addRequests([{
                        url: d.url,
                        userData: { type: 'DISTRICT', district: d.name },
                    }]);
                }
            }

            if (request.userData.type === 'DISTRICT') {
                log.info(`🏙️ A extrair concelhos de ${request.userData.district}...`);
                const councils = await extractLinks($, 'a[href*="/comprar/apartamento/"]');
                for (const c of councils) {
                    locations[request.userData.district][c.name] = [];
                    await crawler.addRequests([{
                        url: c.url,
                        userData: { type: 'COUNCIL', district: request.userData.district, council: c.name },
                    }]);
                }
            }

            if (request.userData.type === 'COUNCIL') {
                log.info(`🏘️ A extrair freguesias de ${request.userData.council}...`);
                const parishes = await extractLinks($, 'a[href*="/comprar/apartamento/"]');
                for (const p of parishes) {
                    locations[request.userData.district][request.userData.council].push(p.name);
                }
            }
        },
    });

    await crawler.run([{ url: startUrl, userData: { type: 'START' } }]);

    // Guardar no OUTPUT
    const store = await KeyValueStore.open();
    await store.setValue('locations.json', locations);
    console.log('✅ locations.json gerado com sucesso!');
}

run();
