import fs from "fs";

const BASE_URL = "https://www.imovirtual.com/api/query";

// distritos de Portugal
const DISTRITOS = [
  "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco",
  "Coimbra", "Évora", "Faro", "Guarda", "Leiria", "Lisboa",
  "Portalegre", "Porto", "Santarém", "Setúbal", "Viana do Castelo",
  "Vila Real", "Viseu", "Madeira", "Açores"
];

// Hash para searchLocations (precisa ser descoberto)
// O hash que tens é para locationDetails, não searchLocations
const SEARCH_LOCATIONS_HASH = "30ccad1c22aa1c4037487a73d351281d37e7b5ecb268a3d7e9fd99b2a7a83942"; // Este pode não estar correcto

async function fetchLocations(query) {
  console.log(`🔎 Query: ${query}`);

  // Construir URL com parâmetros
  const params = new URLSearchParams({
    operationName: "searchLocations",
    variables: JSON.stringify({ query }),
    extensions: JSON.stringify({
      persistedQuery: {
        version: 1,
        sha256Hash: SEARCH_LOCATIONS_HASH,
      }
    })
  });

  const url = `${BASE_URL}?${params}`;
  console.log(`🌐 URL: ${url}`);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "pt-PT,pt;q=0.9,en;q=0.8",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "referer": "https://www.imovirtual.com/",
        "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin"
      }
    });

    console.log(`📊 Status: ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text();
      console.log(`❌ Erro HTTP ${res.status}: ${errorText.substring(0, 200)}...`);
      return [];
    }

    const json = await res.json();
    console.log(`📍 Resposta:`, JSON.stringify(json, null, 2));
    
    const locations = json?.data?.searchLocations || [];
    console.log(`📍 Encontradas ${locations.length} localizações para "${query}"`);
    return locations;
  } catch (error) {
    console.error(`❌ Erro ao fazer fetch para "${query}":`, error.message);
    return [];
  }
}

async function testDifferentHashes(query) {
  // Hashes possíveis (o teu exemplo + o original)
  const possibleHashes = [
    "30ccad1c22aa1c4037487a73d351281d37e7b5ecb268a3d7e9fd99b2a7a83942", // original
    "0a4a1880e6a922d070725b0f6b114c3096d2675950e1da22f4686c1158add5f2"  // do teu exemplo
  ];

  for (const hash of possibleHashes) {
    console.log(`🧪 Testando hash: ${hash.substring(0, 16)}...`);
    
    const params = new URLSearchParams({
      operationName: "searchLocations",
      variables: JSON.stringify({ query }),
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: hash,
        }
      })
    });

    const url = `${BASE_URL}?${params}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "accept": "application/graphql-response+json, application/graphql+json, application/json",
          "accept-language": "pt-PT,pt;q=0.9,en;q=0.8",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "referer": "https://www.imovirtual.com/",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin"
        }
      });

      console.log(`   Status: ${res.status}`);
      
      if (res.ok) {
        const result = await res.json();
        console.log(`   ✅ Hash funciona!`, result);
        return hash;
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
  
  return null;
}

async function discoverSearchOperation() {
  console.log("🔍 A tentar descobrir a operação correcta...");
  
  // Operações possíveis
  const operations = ["searchLocations", "locationSearch", "findLocations", "autocomplete"];
  
  for (const operation of operations) {
    console.log(`🧪 Testando operação: ${operation}`);
    
    const params = new URLSearchParams({
      operationName: operation,
      variables: JSON.stringify({ query: "lisboa" }),
      extensions: JSON.stringify({
        persistedQuery: {
          version: 1,
          sha256Hash: "0a4a1880e6a922d070725b0f6b114c3096d2675950e1da22f4686c1158add5f2",
        }
      })
    });

    const url = `${BASE_URL}?${params}`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "accept": "application/graphql-response+json, application/graphql+json, application/json",
          "accept-language": "pt-PT,pt;q=0.9,en;q=0.8",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "referer": "https://www.imovirtual.com/"
        }
      });

      console.log(`   Status: ${res.status}`);
      
      if (res.status !== 404) {
        const result = await res.text();
        console.log(`   🎯 Resposta para ${operation}:`, result.substring(0, 300));
      }
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
}

async function run() {
  console.log("📡 A descobrir endpoint correcto...");

  // Primeiro descobrir qual operação usar
  await discoverSearchOperation();

  // Testar diferentes hashes
  const workingHash = await testDifferentHashes("lisboa");
  
  if (!workingHash) {
    console.log("❌ Não consegui encontrar um hash que funcione.");
    console.log("💡 Precisas de:");
    console.log("   1. Ir ao site imovirtual.com");
    console.log("   2. Fazer uma pesquisa de localização");
    console.log("   3. Copiar a request completa do DevTools");
    console.log("   4. Partilhar o operationName, hash e parâmetros correctos");
    return;
  }

  console.log(`✅ Hash que funciona: ${workingHash}`);
  
  // Se chegou aqui, continuar com o resto da implementação
  console.log("🎯 A continuar com extração completa...");
}

run().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
