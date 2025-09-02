import { Actor } from 'apify';
import { gotScraping } from 'got-scraping';

const IMOVIRTUAL_API = 'https://www.imovirtual.com/api/query';

// Query GraphQL exata da captura do DevTools
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
    
    // Payload exato da captura do DevTools
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

    // Headers simplificados mas essenciais
    const headers = {
        'accept': 'application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9,pt;q=0.8',
        'content-type': 'application/json',
        'origin': 'https://www.imovirtual.com',
        'referer': 'https://www.imovirtual.com/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
    };

    try {
        const response = await gotScraping.post(IMOVIRTUAL_API, {
            json: payload,
            headers: headers,
            responseType: 'json',
            timeout: 30000  // timeout simples em ms
        });

        console.log(`✅ Resposta recebida com status: ${response.statusCode}`);
        
        if (response.body?.errors) {
            console.log(`⚠️ Erros na resposta:`, response.body.errors);
        }
        
        return response.body;
    } catch (error) {
        console.error(`❌ Erro na requisição para "${query}":`, error.message);
        if (error.response) {
            console.error(`📊 Status: ${error.response.statusCode}`);
            console.error(`📄 Resposta:`, JSON.stringify(error.response.body, null, 2));
        }
        throw error;
    }
}

function processLocations(data, queryTerm) {
    const locations = {
        districts: new Set(),
        councils: new Set(), 
        parishes: new Set(),
        neighborhoods: new Set()
    };

    if (!data?.data?.autocomplete?.locationsObjects) {
        console.log(`⚠️ Sem dados de localização para "${queryTerm}"`);
        console.log('Estrutura recebida:', JSON.stringify(data, null, 2));
        return locations;
    }

    const locationsObjects = data.data.autocomplete.locationsObjects;
    console.log(`📊 Processando ${locationsObjects.length} localizações para "${queryTerm}"`);

    for (const location of locationsObjects) {
        const { id, detailedLevel, name, fullName, children } = location;
        
        const locationData = {
            id,
            name,
            fullName,
            level: detailedLevel,
            source: queryTerm
        };

        switch (detailedLevel) {
            case 'district':
                locations.districts.add(JSON.stringify(locationData));
                console.log(`🏛️ Distrito: ${fullName}`);
                break;
            case 'council':
                locations.councils.add(JSON.stringify(locationData));
                console.log(`🏘️ Concelho: ${fullName}`);
                break;
            case 'parish':
                locations.parishes.add(JSON.stringify(locationData));
                console.log(`⛪ Freguesia: ${fullName}`);
                break;
            case 'neighborhood':
                locations.neighborhoods.add(JSON.stringify(locationData));
                console.log(`🏠 Bairro: ${fullName}`);
                break;
        }

        // Processar children se existirem
        if (children && Array.isArray(children)) {
            for (const child of children) {
                const childData = {
                    id: child.id,
                    name: child.name,
                    fullName: child.fullName,
                    level: child.detailedLevel,
                    source: queryTerm,
                    parent: fullName
                };

                switch (child.detailedLevel) {
                    case 'parish':
                        locations.parishes.add(JSON.stringify(childData));
                        console.log(`  ⛪ Freguesia: ${child.fullName}`);
                        break;
                    case 'neighborhood':
                        locations.neighborhoods.add(JSON.stringify(childData));
                        console.log(`  🏠 Bairro: ${child.fullName}`);
                        break;
                }

                // Processar grandchildren
                if (child.children && Array.isArray(child.children)) {
                    for (const grandChild of child.children) {
                        if (grandChild.detailedLevel === 'neighborhood') {
                            const grandChildData = {
                                id: grandChild.id,
                                name: grandChild.name,
                                fullName: grandChild.fullName,
                                level: grandChild.detailedLevel,
                                source: queryTerm,
                                parent: child.fullName
                            };
                            locations.neighborhoods.add(JSON.stringify(grandChildData));
                            console.log(`    🏠 Bairro: ${grandChild.fullName}`);
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

    // Testar conectividade primeiro com configurações simplificadas
    try {
        const testResponse = await gotScraping.get('https://www.imovirtual.com/', { 
            timeout: 10000,
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
            }
        });
        console.log(`✅ Site principal acessível: ${testResponse.statusCode}`);
    } catch (error) {
        console.error('❌ Erro ao aceder ao site principal:', error.message);
        console.log('🔄 Continuando mesmo assim...');
    }

    const allLocations = {
        districts: new Set(),
        councils: new Set(),
        parishes: new Set(),
        neighborhoods: new Set()
    };

    // Queries principais para Portugal - começar pequeno para testar
    const mainQueries = [
        'lisboa', 'porto', 'coimbra', 'braga', 'setúbal'
    ];

    let successfulQueries = 0;
    let totalProcessed = 0;

    for (const query of mainQueries) {
        try {
            console.log(`\n📄 Processando query ${totalProcessed + 1}/${mainQueries.length}: "${query}"`);
            
            const data = await makeGraphQLRequest(query);
            
            if (data?.data?.autocomplete?.locationsObjects) {
                const locations = processLocations(data, query);
                
                // Combinar resultados usando Sets para evitar duplicados
                for (const item of locations.districts) allLocations.districts.add(item);
                for (const item of locations.councils) allLocations.councils.add(item);
                for (const item of locations.parishes) allLocations.parishes.add(item);
                for (const item of locations.neighborhoods) allLocations.neighborhoods.add(item);
                
                successfulQueries++;
                console.log(`✅ Query "${query}" processada com sucesso`);
            } else {
                console.log(`⚠️ Sem dados válidos para "${query}"`);
                console.log('Resposta completa:', JSON.stringify(data, null, 2));
            }
            
            totalProcessed++;
            
            // Pausa entre requests para evitar rate limiting
            console.log('⏳ Aguardando 2 segundos...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`❌ Falha na query "${query}":`, error.message);
            totalProcessed++;
            continue;
        }
    }

    // Converter Sets de volta para Arrays e parsear JSON
    const finalData = {
        districts: Array.from(allLocations.districts).map(item => JSON.parse(item)),
        councils: Array.from(allLocations.councils).map(item => JSON.parse(item)),
        parishes: Array.from(allLocations.parishes).map(item => JSON.parse(item)),
        neighborhoods: Array.from(allLocations.neighborhoods).map(item => JSON.parse(item)),
        metadata: {
            extractedAt: new Date().toISOString(),
            totalDistricts: allLocations.districts.size,
            totalCouncils: allLocations.councils.size,
            totalParishes: allLocations.parishes.size,
            totalNeighborhoods: allLocations.neighborhoods.size,
            successfulQueries: successfulQueries,
            totalQueries: mainQueries.length,
            source: 'imovirtual.com',
            endpoint: IMOVIRTUAL_API
        }
    };

    console.log('\n📊 EXTRAÇÃO CONCLUÍDA!');
    console.log('=====================================');
    console.log(`🏛️ Distritos encontrados: ${finalData.metadata.totalDistricts}`);
    console.log(`🏘️ Concelhos encontrados: ${finalData.metadata.totalCouncils}`);
    console.log(`⛪ Freguesias encontradas: ${finalData.metadata.totalParishes}`);
    console.log(`🏠 Bairros encontrados: ${finalData.metadata.totalNeighborhoods}`);
    console.log(`✅ Queries bem-sucedidas: ${successfulQueries}/${mainQueries.length}`);
    console.log('=====================================');

    // Guardar no dataset do Apify
    await Actor.pushData(finalData);
    
    console.log('💾 Dados guardados no dataset do Apify');
    
    // Também guardar dados individuais para facilitar análise
    for (const district of finalData.districts) {
        await Actor.pushData({ type: 'district', ...district });
    }
    for (const council of finalData.councils) {
        await Actor.pushData({ type: 'council', ...council });
    }
    for (const parish of finalData.parishes) {
        await Actor.pushData({ type: 'parish', ...parish });
    }
    for (const neighborhood of finalData.neighborhoods) {
        await Actor.pushData({ type: 'neighborhood', ...neighborhood });
    }
    
    console.log('✅ Dados individuais também guardados para facilitar análise');
});
