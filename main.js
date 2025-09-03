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

    // Headers baseados na captura do DevTools
    const headers = {
        'accept': 'application/graphql-response+json, application/graphql+json, application/json, text/event-stream, multipart/mixed',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9,pt;q=0.8',
        'content-type': 'application/json',
        'origin': 'https://www.imovirtual.com',
        'referer': 'https://www.imovirtual.com/',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
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
            timeout: {
                request: 30000
            },
            retry: {
                limit: 2,
                methods: ['POST']
            },
            throwHttpErrors: false
        });

        console.log(`✅ Resposta recebida com status: ${response.statusCode}`);
        
        if (response.statusCode !== 200) {
            console.log(`⚠️ Status não é 200:`, response.statusCode);
            console.log(`📄 Resposta:`, JSON.stringify(response.body, null, 2));
            return null;
        }
        
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
        return null;
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
    console.log('📡 A iniciar extração COMPLETA de localizações do Imovirtual...');

    const allLocations = {
        districts: new Set(),
        councils: new Set(),
        parishes: new Set(),
        neighborhoods: new Set()
    };

    // FASE 1: Todos os distritos de Portugal
    const allDistricts = [
        'lisboa', 'porto', 'coimbra', 'braga', 'aveiro', 'faro', 'leiria',
        'santarem', 'setubal', 'viseu', 'viana do castelo', 'vila real',
        'braganca', 'castelo branco', 'evora', 'guarda', 'portalegre',
        'beja', 'ilha da madeira', 'ilha de sao miguel', 'terceira'
    ];

    // FASE 2: Principais cidades e concelhos para expandir cobertura
    const majorCities = [
        'amadora', 'sintra', 'cascais', 'oeiras', 'loures', 'odivelas', 'mafra',
        'vila franca de xira', 'sesimbra', 'almada', 'seixal', 'barreiro',
        'matosinhos', 'vila nova de gaia', 'gondomar', 'maia', 'valongo',
        'povoa de varzim', 'felgueiras', 'pacos de ferreira', 'penafiel',
        'figueira da foz', 'cantanhede', 'oliveira do bairro', 'agueda',
        'ilhavo', 'ovar', 'santa maria da feira', 'sao joao da madeira',
        'guimaraes', 'famalicao', 'barcelos', 'esposende', 'viana do castelo',
        'ponte de lima', 'torres vedras', 'caldas da rainha', 'obidos',
        'nazare', 'marinha grande', 'alcobaca', 'batalha', 'pombal',
        'torres novas', 'entroncamento', 'tomar', 'constancia', 'abrantes',
        'palmela', 'montijo', 'alcochete', 'moita', 'portimao', 'lagos',
        'silves', 'albufeira', 'loule', 'tavira', 'vila real de santo antonio',
        'olhao', 'lagoa', 'monchique', 'funchal', 'machico', 'camara de lobos',
        'ponta delgada', 'ribeira grande', 'lagoa', 'angra do heroismo'
    ];

    // FASE 3: Termos genéricos para capturar localizações específicas
    const genericTerms = [
        'centro', 'baixa', 'alta', 'norte', 'sul', 'este', 'oeste',
        'santo antonio', 'sao', 'santa', 'vila', 'aldeia', 'monte',
        'praia', 'costa', 'serra', 'campo', 'jardim', 'parque'
    ];

    let allQueries = [...allDistricts, ...majorCities, ...genericTerms];
    
    let successfulQueries = 0;
    let totalProcessed = 0;

    console.log(`🎯 Total de queries a processar: ${allQueries.length}`);

    for (const query of allQueries) {
        try {
            console.log(`\n📄 Processando query ${totalProcessed + 1}/${allQueries.length}: "${query}"`);
            
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
            }
            
            totalProcessed++;
            
            // Pausa variável para evitar rate limiting
            const waitTime = totalProcessed % 10 === 0 ? 5000 : 2000; // Pausa maior a cada 10 queries
            console.log(`⏳ Aguardando ${waitTime/1000} segundos...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
        } catch (error) {
            console.error(`❌ Falha na query "${query}":`, error.message);
            totalProcessed++;
            continue;
        }
    }

    // FASE 4: Usar os concelhos encontrados para fazer queries mais específicas
    console.log(`\n🔄 FASE 2: A expandir com base nos concelhos encontrados...`);
    
    const councilNames = Array.from(allLocations.councils)
        .map(item => JSON.parse(item))
        .map(council => council.name.toLowerCase())
        .filter(name => !allQueries.map(q => q.toLowerCase()).includes(name))
        .slice(0, 20); // Limitar para não sobrecarregar

    for (const councilName of councilNames) {
        try {
            console.log(`\n📄 Expandindo concelho: "${councilName}"`);
            
            const data = await makeGraphQLRequest(councilName);
            
            if (data?.data?.autocomplete?.locationsObjects) {
                const locations = processLocations(data, councilName);
                
                for (const item of locations.districts) allLocations.districts.add(item);
                for (const item of locations.councils) allLocations.councils.add(item);
                for (const item of locations.parishes) allLocations.parishes.add(item);
                for (const item of locations.neighborhoods) allLocations.neighborhoods.add(item);
                
                successfulQueries++;
            }
            
            totalProcessed++;
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.error(`❌ Falha na expansão "${councilName}":`, error.message);
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
            totalQueries: totalProcessed,
            source: 'imovirtual.com',
            endpoint: IMOVIRTUAL_API
        }
    };

    console.log('\n📊 EXTRAÇÃO COMPLETA CONCLUÍDA!');
    console.log('=====================================');
    console.log(`🏛️ Distritos encontrados: ${finalData.metadata.totalDistricts}`);
    console.log(`🏘️ Concelhos encontrados: ${finalData.metadata.totalCouncils}`);
    console.log(`⛪ Freguesias encontradas: ${finalData.metadata.totalParishes}`);
    console.log(`🏠 Bairros encontrados: ${finalData.metadata.totalNeighborhoods}`);
    console.log(`✅ Queries bem-sucedidas: ${successfulQueries}/${totalProcessed}`);
    console.log('=====================================');

    // Verificar se encontramos Loures e suas freguesias
    const louresResults = finalData.parishes.filter(p => 
        p.fullName.toLowerCase().includes('loures') || 
        p.fullName.toLowerCase().includes('santo antonio dos cavaleiros')
    );
    
    if (louresResults.length > 0) {
        console.log('\n🎯 Freguesias de Loures encontradas:');
        louresResults.forEach(parish => {
            console.log(`  ✅ ${parish.fullName}`);
        });
    }

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
