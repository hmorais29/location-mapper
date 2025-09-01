import { Actor } from "apify";

await Actor.init();

// Função para chamar o endpoint searchLocations
async function searchLocations(query) {
    const baseUrl = "https://www.imovirtual.com/api/query";
    const variables = { query };
    const extensions = {
        persistedQuery: {
            sha256Hash: "bf12aa8f69e91f08924d6c5adcb6dbb67d6b8e4b6e74a1c37d7468f54b1e82a1", // hash usado no searchLocations
            version: 1
        }
    };

    const url = `${baseUrl}?operationName=searchLocations&variables=${encodeURIComponent(
        JSON.stringify(variables)
    )}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;

    const response = await fetch(url, {
        headers: {
            "accept": "application/graphql-response+json, application/graphql+json, application/json",
            "user-agent": "Mozilla/5.0 (compatible; ApifyBot/1.0; +https://apify.com)"
        }
    });

    if (!response.ok) {
        throw new Error(`❌ Erro no searchLocations(${query}): ${response.status} ${response.statusText}`);
    }

    return response.json();
}

async function run() {
    const input = await Actor.getInput();
    if (!input?.queries || !Array.isArray(input.queries)) {
        throw new Error("⚠️ O input.json precisa de conter { queries: [ ... ] }");
    }

    for (const query of input.queries) {
        try {
            console.log(`🔎 A pesquisar: ${query}`);
            const data = await searchLocations(query);

            if (data?.data?.searchLocations?.length) {
                for (const loc of data.data.searchLocations) {
                    await Actor.pushData({
                        id: loc.id,
                        name: loc.name,
                        type: loc.type
                    });
                }
                console.log(`✅ Encontrado: ${query}`);
            } else {
                console.warn(`⚠️ Nada encontrado para: ${query}`);
            }
        } catch (err) {
            console.error(`❌ Falhou query "${query}":`, err.message);
        }
    }
}

await run();
await Actor.exit();
