import fs from "fs";

const ENDPOINT = "https://www.imovirtual.com/graphql";

// distritos de Portugal
const DISTRITOS = [
  "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco",
  "Coimbra", "Évora", "Faro", "Guarda", "Leiria", "Lisboa",
  "Portalegre", "Porto", "Santarém", "Setúbal", "Viana do Castelo",
  "Vila Real", "Viseu", "Madeira", "Açores"
];

async function fetchLocations(query) {
  console.log(`🔎 Query: ${query}`);

  const body = {
    operationName: "searchLocations",
    variables: { query },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "30ccad1c22aa1c4037487a73d351281d37e7b5ecb268a3d7e9fd99b2a7a83942",
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
  return json?.data?.searchLocations || [];
}

async function run() {
  console.log("📡 A obter hierarquia completa de localizações...");

  const results = [];
  const seen = new Set();

  for (const distrito of DISTRITOS) {
    // procurar distrito pelas primeiras letras
    const distritoSearch = distrito.substring(0, 3).toLowerCase();
    const candidatos = await fetchLocations(distritoSearch);

    const distritoMatch = candidatos.find(
      (c) => c.type === "district" && c.name.toLowerCase().includes(distrito.toLowerCase())
    );

    if (!distritoMatch) {
      console.warn(`⚠️ Não encontrei distrito para ${distrito}`);
      continue;
    }

    if (!seen.has(distritoMatch.id)) {
      seen.add(distritoMatch.id);
      results.push({
        id: distritoMatch.id,
        name: distritoMatch.name,
        type: distritoMatch.type,
      });
    }

    // concelhos do distrito
    const concelhos = await fetchLocations(distritoMatch.name);
    for (const concelho of concelhos) {
      if (!seen.has(concelho.id)) {
        seen.add(concelho.id);
        results.push({
          id: concelho.id,
          name: concelho.name,
