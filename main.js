import { Actor } from "apify";

await Actor.init();

// Função para chamar o endpoint do Imovirtual
async function getLocationDetails(locationId) {
    const baseUrl = "https://www.imovirtual.com/api/query";
    const variables = {
        id: locationId,
        locationLevelLikeDistrictAndSubdistrict: ["parish", "neighborhood"]
    };
    const extensions = {
        persistedQuery: {
            sha256Hash: "0a4a1880e6a922d070725b0f6b114c3096d2675950e1da22f4686c1158add5f2",
            version: 1
        }
    };

    const url = `${baseUrl}?operationName=locationDetails&variables=${encodeURIComponent(
        JSON.stringify(variables)
    )}&extensions=${encodeURIComponent(JSON.stringify(extensions))}`;

    const response = await fetch(url, {
        headers: {
            "accept": "application/graphql-response+json, application/graphql+json, application/json",
            "user-agent": "Mozilla/5.0 (compatible; ApifyBot/1.0; +https://apify.com)"
        }
    });

    if (!response.ok) {
        throw new Error(`❌ Erro ao obter ${locationId}: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

async function run() {
    const input = await Actor.getInput();
    if (!input?.locations || !Array.isArray(input.locations)) {
        throw new Error("⚠️ O input.json precisa de conter { locations: [ ... ] }");
    }

    for (const locationId of input.locations) {
        try {
            console.log(`📡 A obter localizações para: ${locationId}`);
            const data = await getLocationDetails(locationId);

            await Actor.pushData({
                locationId,
                data
            });

            console.log(`✅ Sucesso: ${locationId}`);
        } catch (err) {
            console.error(`❌ Falhou ${locationId}:`, err.message);
        }
    }
}

await run();
await Actor.exit();
