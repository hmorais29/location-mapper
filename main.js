import fs from "fs";

const ENDPOINT = "https://www.imovirtual.com/graphql";

// distritos de Portugal
const DISTRITOS = [
  "Aveiro", "Beja", "Braga", "Bragança", "Castelo Branco",
  "Coimbra", "Évora", "Faro", "Guarda", "Leiria", "Lisboa",
  "Portalegre", "Porto", "Santarém", "Setúbal", "Viana do Castelo",
  "Vila Real", "Viseu", "Madeira", "Açores"
];

async function testEndpoint() {
  console.log("🔍 A testar conectividade do endpoint...");
  
  try {
    // Teste básico de conectividade
    const testResponse = await fetch("https://www.imovirtual.com", {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    console.log(`✅ Site principal acessível: ${testResponse.status}`);
  } catch (error) {
    console.log(`❌ Site principal não acessível: ${error.message}`);
  }

  // Teste do endpoint GraphQL
  try {
    const graphqlResponse = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        "Origin": "https://www.imovirtual.com",
        "Referer": "https://www.imovirtual.com/"
      },
      body: JSON.stringify({
        query: "{ __typename }"
      })
    });
    console.log(`📡 GraphQL endpoint status: ${graphqlResponse.status}`);
    
    if (!graphqlResponse.ok) {
      const errorText = await graphqlResponse.text();
      console.log(`❌ Resposta do GraphQL: ${errorText.substring(0, 200)}...`);
    } else {
      const result = await graphqlResponse.json();
      console.log("✅ GraphQL endpoint acessível:", result);
    }
  } catch (error) {
    console.log(`❌ Erro no GraphQL endpoint: ${error.message}`);
  }
}

async function fetchLocations(query) {
  console.log(`🔎 Query: ${query}`);

  const body = {
    operationName: "searchLocations",
    variables: { query },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: "30ccad1c22aa1c4037487a73d351281d37e7b5ecb268a3d7e9fd99b2a7a83942",
      },
    },
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        "Origin": "https://www.imovirtual.com",
        "Referer": "https://www.imovirtual.com/",
        "x-apollo-operation-name": "searchLocations",
      },
      body: JSON.stringify(body),
    });

    console.log(`📊 Status: ${res.status}, Headers:`, Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      const errorText = await res.text();
      console.log(`❌ Erro HTTP ${res.status}: ${errorText.substring(0, 300)}`);
      return [];
    }

    const json = await res.json();
    console.log(`📍 Resposta completa:`, JSON.stringify(json, null, 2));
    
    const locations = json?.data?.searchLocations || [];
    console.log(`📍 Encontradas ${locations.length} localizações para "${query}"`);
    return locations;
  } catch (error) {
    console.error(`❌ Erro ao fazer fetch para "${query}":`, error.message);
    return [];
  }
}

async function tryAlternativeQuery(query) {
  console.log(`🔄 Tentando query alternativa para: ${query}`);
  
  // Tentar query sem persistedQuery
  const alternativeBody = {
    query: `
      query searchLocations($query: String!) {
        searchLocations(query: $query) {
          id
          name
          type
        }
      }
    `,
    variables: { query }
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        "Origin": "https://www.imovirtual.com",
        "Referer": "https://www.imovirtual.com/"
      },
      body: JSON.stringify(alternativeBody),
    });

    console.log(`🔄 Status alternativo: ${res.status}`);

    if (res.ok) {
      const json = await res.json();
      console.log(`🔄 Resposta alternativa:`, json);
      return json?.data?.searchLocations || [];
    }
  } catch (error) {
    console.log(`🔄 Erro na query alternativa: ${error.message}`);
  }
  
  return [];
}

async function run() {
  console.log("📡 A obter hierarquia completa de localizações...");

  // Primeiro testar a conectividade
  await testEndpoint();

  // Testar com uma query simples
  console.log("\n🧪 Testando com query simples...");
  const testResult = await fetchLocations("lisboa");
  
  if (testResult.length === 0) {
    console.log("\n🔄 Tentando abordagem alternativa...");
    const altResult = await tryAlternativeQuery("lisboa");
    
    if (altResult.length === 0) {
      console.log("❌ Nenhuma abordagem funcionou. O endpoint pode ter mudado ou ter protecções anti-bot.");
      console.log("💡 Sugestões:");
      console.log("   1. Verificar se o site imovirtual.com ainda usa este endpoint");
      console.log("   2. Inspecionar as Network requests no browser ao usar o site");
      console.log("   3. Verificar se precisas de cookies ou tokens de autenticação");
      return;
    }
  }

  console.log("✅ Endpoint funciona! A continuar com extração completa...");

  // Resto do código original se o teste passar
  const results = [];
  const seen = new Set();

  // Apenas testar com alguns distritos primeiro
  const testDistritos = DISTRITOS.slice(0, 3);

  for (let i = 0; i < testDistritos.length; i++) {
    const distrito = testDistritos[i];
    console.log(`\n🏛️ Testando distrito ${i + 1}/${testDistritos.length}: ${distrito}`);

    try {
      const distritoSearch = distrito.substring(0, 3).toLowerCase();
      const candidatos = await fetchLocations(distritoSearch);

      if (candidatos.length > 0) {
        console.log("✅ Encontrados resultados! A continuar com implementação completa...");
        break;
      }

    } catch (error) {
      console.error(`❌ Erro ao processar distrito ${distrito}:`, error.message);
      continue;
    }
  }

  console.log("\n📊 Teste concluído.");
}

run().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
