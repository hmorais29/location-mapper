import fetch from 'node-fetch';
import { KeyValueStore } from 'crawlee';

async function run() {
    const url = 'https://www.imovirtual.com/api/locations';
    console.log(`📡 A obter localizações de ${url}...`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro ao obter dados: ${response.statusText}`);
    }

    const data = await response.json();

    // A API já devolve a estrutura completa de distritos/concelhos/freguesias
    const store = await KeyValueStore.open();
    await store.setValue('locations.json', data);

    console.log('✅ locations.json guardado no OUTPUT!');
}

run().catch(err => {
    console.error('❌ Erro:', err);
});
