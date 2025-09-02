// main.js do location-mapper melhorado

import fs from "fs";
import { Actor } from "apify";

await Actor.init();

async function fetchLocations(query) {
    const url = `https://www.imovirtual.com/api/query?operationName=searchLocations&variables=%7B%22query%22%3A%22${encodeURIComponent(
        query
    )}%22%7D&extensions=%7B%22persistedQuery%22%3A%7B%22sha256Hash%22%3A%2230ccad1c22aa1c4037487a73d351281d37e7b5ecb268a3d7e9fd99b2a7a83942%22%2C%22version%22%3A1%7D%7D`;

    const response = await fetch(url, {
        headers: {
            accept: "application/json",
            "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        },
    });

    if (!response.ok) {
        throw new Error(`❌ Erro no fetch: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data?.data?.searchLocations || [];
}

async function run() {
    console.log("📡 A obter localizações do Imovirtual...");

    const letters = "abcdefghijklmnopqrstuvwxyz".split("");
    const allLocations = new Map();

    for (const letter of letters) {
        console.log(`🔎 Query: ${letter}`);
        const results = await fetchLocations(letter);

        for (const loc of results) {
            allLocations.set(loc.id, {
                id: loc.id,
                name: loc.name,
                type: loc.type,
            });
        }
        // pequena pausa para não abusar
        await new Promise((r) => setTimeout(r, 500));
    }

    const cleanLocations = Array.from(allLocations.values());

    console.log(`✅ Extraídas ${cleanLocations.length} localizações únicas`);

    await Actor.setValue("locations.json", cleanLocations);

    console.log("📂 locations.json gravado com sucesso!");
}

await run();
await Actor.exit();
