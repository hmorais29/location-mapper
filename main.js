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

  try {
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
    const locations = json?.data?.searchLocations || [];
    console.log(`📍 Encontradas ${locations.length} localizações para "${query}"`);
    return locations;
  } catch (error) {
    console.error(`❌ Erro ao fazer fetch para "${query}":`, error.message);
    return [];
  }
}

async function run() {
  console.log("📡 A obter hierarquia completa de localizações...");

  const results = [];
  const seen = new Set();

  for (let i = 0; i < DISTRITOS.length; i++) {
    const distrito = DISTRITOS[i];
    console.log(`\n🏛️ Processando distrito ${i + 1}/${DISTRITOS.length}: ${distrito}`);

    try {
      // procurar distrito pelas primeiras 2-3 letras
      const distritoSearch = distrito.substring(0, 3).toLowerCase();
      console.log(`🔍 Procurando por: "${distritoSearch}"`);
      
      const candidatos = await fetchLocations(distritoSearch);

      // procurar o distrito correto nos resultados
      const distritoMatch = candidatos.find(
        (c) => c.type === "district" && 
               c.name.toLowerCase().includes(distrito.toLowerCase().substring(0, 4))
      );

      if (!distritoMatch) {
        console.warn(`⚠️ Não encontrei distrito para ${distrito}`);
        // tentar com apenas 2 letras
        const distritoSearch2 = distrito.substring(0, 2).toLowerCase();
        console.log(`🔍 Tentando com 2 letras: "${distritoSearch2}"`);
        const candidatos2 = await fetchLocations(distritoSearch2);
        const distritoMatch2 = candidatos2.find(
          (c) => c.type === "district" && 
                 c.name.toLowerCase().includes(distrito.toLowerCase().substring(0, 3))
        );
        
        if (!distritoMatch2) {
          console.warn(`⚠️ Distrito ${distrito} não encontrado mesmo com 2 letras, continuando...`);
          continue;
        } else {
          console.log(`✅ Encontrado distrito: ${distritoMatch2.name}`);
        }
      } else {
        console.log(`✅ Encontrado distrito: ${distritoMatch.name}`);
      }

      const distritoFinal = distritoMatch || distritoMatch2;

      if (!seen.has(distritoFinal.id)) {
        seen.add(distritoFinal.id);
        results.push({
          id: distritoFinal.id,
          name: distritoFinal.name,
          type: distritoFinal.type,
        });
        console.log(`📋 Adicionado distrito: ${distritoFinal.name} (ID: ${distritoFinal.id})`);
      }

      // concelhos do distrito
      console.log(`🏘️ Procurando concelhos de ${distritoFinal.name}...`);
      const concelhos = await fetchLocations(distritoFinal.name);
      let concelhosCount = 0;

      for (const concelho of concelhos) {
        if (concelho.type === "municipality" && !seen.has(concelho.id)) {
          seen.add(concelho.id);
          results.push({
            id: concelho.id,
            name: concelho.name,
            type: concelho.type,
          });
          concelhosCount++;

          // freguesias do concelho
          console.log(`🏡 Procurando freguesias de ${concelho.name}...`);
          const freguesias = await fetchLocations(concelho.name);
          let freguesiasCount = 0;

          for (const freguesia of freguesias) {
            if (freguesia.type === "parish" && !seen.has(freguesia.id)) {
              seen.add(freguesia.id);
              results.push({
                id: freguesia.id,
                name: freguesia.name,
                type: freguesia.type,
              });
              freguesiasCount++;
            }
          }
          console.log(`   ✅ Adicionadas ${freguesiasCount} freguesias de ${concelho.name}`);
        }
      }
      console.log(`✅ Adicionados ${concelhosCount} concelhos de ${distritoFinal.name}`);

    } catch (error) {
      console.error(`❌ Erro ao processar distrito ${distrito}:`, error.message);
      console.log("🔄 Continuando com próximo distrito...");
      continue;
    }

    // pequena pausa entre distritos para não sobrecarregar o servidor
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ Extraídas ${results.length} localizações únicas`);
  console.log(`📊 Resumo:`);
  console.log(`   - Distritos: ${results.filter(r => r.type === 'district').length}`);
  console.log(`   - Concelhos: ${results.filter(r => r.type === 'municipality').length}`);
  console.log(`   - Freguesias: ${results.filter(r => r.type === 'parish').length}`);

  fs.writeFileSync("locations.json", JSON.stringify(results, null, 2));
  console.log("📂 locations.json gravado com sucesso!");
}

run().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
