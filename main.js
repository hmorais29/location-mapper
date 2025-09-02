// main.js do location-mapper (versão zero-input)

import fs from "fs";
import fetch from "node-fetch";
import { Actor } from "apify";

await Actor.init();

async function run() {
    console.log("📡 A obter localizações do Imovirtual...");

    // Endpoint de pesquisa de localizações
    const url = "https://www.imovirtual.com/api/query?operationName=searchLocations&variables=%7B%22query%22%3A%22%22%7D&extensions=%7B%22persistedQuery%22%3A%7B%22sha256Hash%22%3A%2230ccad1c22aa1c4037487a73d351281d37e7b5ecb268a3d7e9fd99b2a7a83942%22%2C%22version%22%3A1%7D%7D";

    const response = await fetch(url, {
        headers: {
            "accept": "application/json",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
    });

    if (!response.ok) {
        throw new Error(`❌ Erro no fetch: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data?.data?.searchLocations) {
        throw new Error("❌ Estrutura inesperada na resposta do Imovirtual");
    }

    // Extrair os campos relevantes
    const cleanLocations = data.data.searchLocations.map(loc => ({
        id: loc.id,
        name: loc.name,
        type: loc.type,
    }));

    console.log(`✅ Extraídas ${cleanLocations.length} localizações`);

    // Guardar no dataset (KeyValueStore)
    await Actor.setValue("locations.json", cleanLocations);

    console.log("📂 locations.json gravado com sucesso!");
}

await run();
await Actor.exit();
