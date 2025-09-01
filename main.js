// location-mapper/main.js
// Requer "type": "module" no package.json
import { KeyValueStore, log } from 'apify';

// Helpers
const stripDiacritics = (s) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

const norm = (s) =>
  stripDiacritics(String(s || ''))
    .toLowerCase()
    .replace(/[\u2019']/g, '')      // apóstrofos
    .replace(/[^a-z0-9]+/g, ' ')    // tudo que não é a-z0-9 vira espaço
    .replace(/\s+/g, ' ')           // espaços múltiplos
    .trim();

const slugify = (s) =>
  stripDiacritics(String(s || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')    // não alfanum -> hífen
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

// Gera sinónimos básicos + trata "União das Freguesias de X e Y"
function synonymsFromName(name) {
  const syns = new Set();
  const base = norm(name);
  syns.add(base);

  // remover "união das freguesias de|da|do|das|dos "
  const cleaned = base.replace(/^uniao das freguesias (de|da|do|das|dos)\s+/, '');
  syns.add(cleaned);

  // se for algo do tipo "x e y" -> adicionar x e y individualmente
  if (cleaned.includes(' e ')) {
    cleaned.split(' e ').forEach((part) => {
      const p = norm(part);
      if (p) syns.add(p);
    });
  }

  // variações com hífen/sem hífen já caem no norm()

  return [...syns].filter(Boolean);
}

// Percorre estrutura genérica { id/slug, name, children[] }
function traverse(node, pathSlugs, pathNames, outTree, synIndex) {
  const slug = (node.slug || node.id || slugify(node.name || '')).toString();
  const name = node.name || slug;

  const nextPathSlugs = [...pathSlugs, slug];
  const nextPathNames = [...pathNames, name];

  // nível 1 -> distrito
  if (pathSlugs.length === 0) {
    if (!outTree[slug]) outTree[slug] = { _name: name, _synonyms: synonymsFromName(name) };
  }
  // nível 2 -> concelho
  else if (pathSlugs.length === 1) {
    const dSlug = pathSlugs[0];
    if (!outTree[dSlug][slug]) {
      outTree[dSlug][slug] = { _name: name, _synonyms: synonymsFromName(name) };
    }
  }
  // nível 3 -> freguesia (folha)
  else if (pathSlugs.length === 2) {
    const dSlug = pathSlugs[0];
    const cSlug = pathSlugs[1];
    if (!outTree[dSlug][cSlug][slug]) {
      outTree[dSlug][cSlug][slug] = { _name: name, _synonyms: synonymsFromName(name) };

      // popular índice de sinónimos -> caminho completo
      const fullPath = `${dSlug}/${cSlug}/${slug}`;
      outTree[dSlug]._synonyms?.forEach((s) => synIndex[s] = dSlug);
      outTree[dSlug][cSlug]._synonyms?.forEach((s) => synIndex[s] = `${dSlug}/${cSlug}`);
      outTree[dSlug][cSlug][slug]._synonyms.forEach((s) => synIndex[s] = fullPath);

      // também índice pelos nomes “normais” do caminho
      const comboNames = [
        norm(`${nextPathNames[0]}`),
        norm(`${nextPathNames[0]} ${nextPathNames[1]}`),
        norm(`${nextPathNames[0]} ${nextPathNames[1]} ${nextPathNames[2]}`),
      ];
      comboNames.forEach((s) => { if (s) synIndex[s] = fullPath; });
    }
  }

  // descer
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    traverse(child, nextPathSlugs, nextPathNames, outTree, synIndex);
  }
}

async function run() {
  const store = await KeyValueStore.open();
  // Endpoint usado pelo frontend do Imovirtual para preencher o filtro de Localização.
  const url = 'https://www.imovirtual.com/api/locations';

  log.info(`📡 A obter localizações: ${url}`);
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (compatible; ApifyBot/1.0)',
    },
  });

  if (!res.ok) {
    throw new Error(`Falha no fetch (${res.status}) ${res.statusText}`);
  }

  const raw = await res.json();

  // A árvore geralmente vem em raw.locations ou raw.data ou raw
  const roots = Array.isArray(raw?.locations) ? raw.locations
              : Array.isArray(raw?.data)      ? raw.data
              : Array.isArray(raw)            ? raw
              : [];

  if (!roots.length) {
    throw new Error('Resposta sem itens de localização. Confirma se o endpoint devolveu dados.');
  }

  // Construir árvore simplificada + índice de sinónimos
  const locations = {};       // { distritoSlug: { _name, _synonyms, concelhoSlug: { _name, _synonyms, fregSlug: {...} } } }
  const synonymsIndex = {};   // { "santo antonio dos cavaleiros": "lisboa/loures/santo-antonio-dos-cavaleiros-e-frielas", ... }

  for (const root of roots) {
    traverse(root, [], [], locations, synonymsIndex);
  }

  const payload = {
    createdAt: new Date().toISOString(),
    locations,
    synonymsIndex,
  };

  // Guardar várias saídas úteis
  await store.setValue('locations_raw.json', raw);
  await store.setValue('locations.json', locations);
  await store.setValue('synonyms.json', synonymsIndex);
  await store.setValue('OUTPUT', payload);

  log.info('✅ Gerado: locations.json, synonyms.json e OUTPUT');
}

run().catch((err) => {
  log.exception(err, '❌ Erro no location-mapper');
  process.exit(1);
});
