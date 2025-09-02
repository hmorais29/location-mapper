import { Actor } from 'apify';
import { gotScraping } from 'got-scraping';

const IMOVIRTUAL_API = 'https://www.imovirtual.com/api/query';

// Query GraphQL exata do DevTools
const AUTOCOMPLETE_QUERY = `query autocomplete($query: String!, $ranking: RankingSystemInput, $levels: [String!], $isLocationSearch: Boolean!, $locationLevelLikeDistrictAndSubdistrict: [String!]) {
  autocomplete(query: $query, ranking: $ranking, levels: $levels) {
    ... on FoundLocations {
      locationsObjects {
        id
        detailedLevel
        name
        fullName
        parents {
          id
          detailedLevel
          name
          fullName
          __typename
        }
        parentIds
        children(
          input: {limit: 4, filters: {levels: $locationLevelLikeDistrictAndSubdistrict}}
        ) @include(if: $isLocationSearch) {
          id
          detailedLevel
          name
          fullName
          parents {
            id
            detailedLevel
            name
            fullName
            __typename
          }
          children(
            input: {limit: 1, filters: {levels: $locationLevelLikeDistrictAndSubdistrict}}
          ) {
            id
            detailedLevel
            name
            fullName
            parents {
              id
              detailedLevel
              name
              fullName
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    ... on ErrorInternal {
      message
      __typename
    }
    __typename
  }
}`;

async function makeGraphQLRequest(query) {
    console.log(`🔍 A pesquisar localizações para: ${query}`);
    
    const payload = {
        extensions: {
            persistedQuery: {
                miss: true,
                sha256Hash: "63dfe8182f8cd71a2493912ed138c743f8fdb43e741e11aff9e53bc34b85c9d6",
                version: 1
            }
        },
        operationName: "autocomplete",
        query: AUTOCOMPLETE_QUERY,
        variables: {
            isLocationSearch: true,
            locationLevelLikeDistrictAndSubdistrict: ["parish", "neighborhood"],
            query: query,
            ranking: {
                type: "BLENDED_INFIX_LOOKUP_SUGGEST"
            }
        }
    };

    const headers = {
        'Accept': 'application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8',
        'Content-Type': 'application/json',
        'Origin': 'https://www.imovirtual.com',
        'Referer': 'https://www.imovirtual.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin'
    };

    try {
        const response = await gotScraping.post(IMOVIRTUAL_API, {
            json: payload,
            headers: headers,
            responseType: 'json',
            timeout: {
                request: 30000
            }
        });

        console.log(`✅ Resposta recebida com status: ${response.statusCode}`);
        return response.body;
    } catch (error) {
        console.error(`❌ Erro na requisição para "${query}":`, error.message);
        if (error.response) {
            console.error(`📊 Status: ${error.response.statusCode}`);
            console.error(`📝 Resposta:`, error.response.body?.substring(0, 500));
        }
        throw error;
    }
}

function processLocations(data) {
    const locations = {
        districts: new Map(),
        councils: new Map(), 
        parishes: new Map(),
        neighborhoods: new Map()
    };

    if (!data?.data?.autocomplete?.locationsObjects) {
        console.log('⚠️ Estrutura de dados inesperada:', JSON.stringify(data, null, 2));
        return locations;
    }

    const locationsObjects = data.data.autocomplete.locationsObjects;
    console.log(`📊 Processando ${locationsObjects.length} localizações encontradas`);

    for (const location of locationsObjects) {
        const { id, detailedLevel, name, fullName, children } = location;
        
        switch (detailedLevel) {
            case 'district':
                locations.districts.set(id, { id, name, fullName });
                break;
            case 'council':
                locations.councils.set(id, { id, name, fullName });
                break;
            case 'parish':
                locations.parishes.set(id, { id, name, fullName });
                break;
            case 'neighborhood':
                locations.neighborhoods.set(id, { id, name, fullName });
                break;
        }

        // Processar children se existirem
        if (children && Array.isArray(children)) {
            for (const child of children) {
                const { id: childId, detailedLevel: childLevel, name: childName, fullName: childFullName, children: grandChildren } = child;
                
                switch (childLevel) {
                    case 'parish':
                        locations.parishes.set(childId, { id: childId, name: childName, fullName: childFullName });
                        break;
                    case 'neighborhood':
                        locations.neighborhoods.set(childId, { id: childId, name: childName, fullName: childFullName });
                        break;
                }

                // Processar grandchildren (neighborhoods dentro de parishes)
                if (grandChildren && Array.isArray(grandChildren)) {
                    for (const grandChild of grandChildren) {
                        if (grandChild.detailedLevel === 'neighborhood') {
                            locations.neighborhoods.set(grandChild.id, { 
                                id: grandChild.id, 
                                name: grandChild.name, 
                                fullName: grandChild.fullName 
                            });
                        }
                    }
                }
            }
        }
    }

    return locations;
}

Actor.main(async () => {
    console.log('📡 A iniciar extração de localizações do Imovirtual...');

    // Primeiro, testar conectividade
    try {
        const testResponse = await gotScraping.get('https://www.imovirtual.com/', { timeout: 10000 });
        console.log(`✅ Site principal acessível: ${testResponse.statusCode}`);
    } catch (error) {
        console.error('❌ Erro ao aceder ao site principal:', error.message);
        process.exit(1);
    }

    const allLocations = {
        districts: new Map(),
        councils: new Map(),
        parishes: new Map(),
        neighborhoods: new Map()
    };

    // Queries principais para obter cobertura completa
    const mainQueries = [
        'lisboa', 'porto', 'coimbra', 'braga', 'setúbal', 'faro', 'aveiro',
        'leiria', 'viseu', 'évora', 'beja', 'castelo branco', 'guarda',
        'portalegre', 'santarém', 'viana do castelo', 'vila real', 'bragança'
    ];

    let processedQueries = 0;

    for (const query of mainQueries) {
        try {
            const data = await makeGraphQLRequest(query);
            const locations = processLocations(data);
            
            // Combinar resultados
            for (const [id, location] of locations.districts) allLocations.districts.set(id, location);
            for (const [id, location] of locations.councils) allLocations.councils.set(id, location);
            for (const [id, location] of locations.parishes) allLocations.parishes.set(id, location);
            for (const [id, location] of locations.neighborhoods) allLocations.neighborhoods.set(id, location);
            
            processedQueries++;
            console.log(`📈 Progresso: ${processedQueries}/${mainQueries.length} queries processadas`);
            
            // Pausa entre requests
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`❌ Falha na query "${query}":`, error.message);
            continue;
        }
    }

    // Preparar dados para output
    const finalData = {
        districts: Array.from(allLocations.districts.values()),
        councils: Array.from(allLocations.councils.values()),
        parishes: Array.from(allLocations.parishes.values()),
        neighborhoods: Array.from(allLocations.neighborhoods.values()),
        metadata: {
            extractedAt: new Date().toISOString(),
            totalDistricts: allLocations.districts.size,
            totalCouncils: allLocations.councils.size,
            totalParishes: allLocations.parishes.size,
            totalNeighborhoods: allLocations.neighborhoods.size,
            source: 'imovirtual.com'
        }
    };

    console.log('📊 Extração concluída!');
    console.log(`   🏛️ Distritos: ${finalData.metadata.totalDistricts}`);
    console.log(`   🏘️ Concelhos: ${finalData.metadata.totalCouncils}`);
    console.log(`   ⛪ Freguesias: ${finalData.metadata.totalParishes}`);
    console.log(`   🏠 Bairros: ${finalData.metadata.totalNeighborhoods}`);

    // Guardar no dataset do Apify
    await Actor.pushData(finalData);
    
    console.log('✅ Dados guardados no dataset do Apify');
});
