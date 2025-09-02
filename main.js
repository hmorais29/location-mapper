import fs from "fs";
import fetch from "node-fetch";

const ENDPOINT = "https://www.imovirtual.com/graphql";

async function fetchLocations(query) {
  console.log(`🔎 Query: ${query}`);

  const body = {
    operationName: "searchLocations",
    variables: { query },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "30ccad1c22aa1c4037487a73d351281d37e7b5ecb268a3d7e9fd99b2a7a83942", // hash usado pelo Imovirtual
      },
    },
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-apollo-operation-name": "searchLocations",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`❌ Erro no fetch ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  if (!json.data || !json.data.searchLocations) {
    console.log("⚠️ Estrutura inesperada:", JSON.stringify(json).slice(0, 200));
    return [];
  }

  return json.data.searchLocations;
}

async function run() {
  console.log("📡 A obter localizações do Imovirtual...");

  // Queries de teste primeiro
  const queries = ["a", "sa", "lis"];
  const seen = new Set();
  const results = [];

  for (const q of queries) {
    try {
      const locs = await fetchLocations(q);
      for (const loc of locs) {
        if (!seen.has(loc.id)) {
          seen.add(loc.id);
          results.push({
            id: loc.id,
            name: loc.name,
            type: loc.type,
          });
        }
      }
    } catch (err) {
      console.error(`❌ Erro na query "${q}":`, err.message);
    }
  }

  console.log(`✅ Extraídas ${results.length} localizações únicas`);

  fs.writeFileSync("locations.json", JSON.stringify(results, null, 2));
  console.log("📂 locations.json gravado com sucesso!");
}

run().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
