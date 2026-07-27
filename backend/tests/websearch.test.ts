// Web search: URL hardening, result parsing and the orchestration contract.
// Every HTTP call is served by a stub `fetch`, so the suite is offline and
// deterministic.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);

import {
  isPublicHttpUrl,
  normaliseResultUrl,
  parseDuckDuckGoHtml,
  parseInstantAnswer,
  parseWikipedia,
  buildContext,
  buildQuery,
  decodeEntities,
  stripTags,
  webSearch,
} from '../src/services/websearch';

let passed = 0;
let failed = 0;

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else { failed++; console.error(`  ✗ ${msg} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`); }
}

// ── isPublicHttpUrl ──────────────────────────────────────────────
{
  eq(isPublicHttpUrl('https://example.com/a'), true, 'https allowed');
  eq(isPublicHttpUrl('http://example.com'), true, 'http allowed');
  eq(isPublicHttpUrl('ftp://example.com'), false, 'ftp rejected');
  eq(isPublicHttpUrl('file:///etc/passwd'), false, 'file rejected');
  eq(isPublicHttpUrl('javascript:alert(1)'), false, 'javascript rejected');
  eq(isPublicHttpUrl('http://localhost:3001/health'), false, 'localhost rejected');
  eq(isPublicHttpUrl('http://127.0.0.1/'), false, 'loopback rejected');
  eq(isPublicHttpUrl('http://10.1.2.3/'), false, '10/8 rejected');
  eq(isPublicHttpUrl('http://172.16.0.1/'), false, '172.16/12 rejected');
  eq(isPublicHttpUrl('http://172.32.0.1/'), true, '172.32 is public');
  eq(isPublicHttpUrl('http://192.168.1.1/'), false, '192.168/16 rejected');
  eq(isPublicHttpUrl('http://169.254.169.254/'), false, 'link-local metadata rejected');
  eq(isPublicHttpUrl('http://[::1]/'), false, 'IPv6 loopback rejected');
  eq(isPublicHttpUrl('http://backend:3001/'), true, 'plain hostname allowed (DNS decides)');
  eq(isPublicHttpUrl('not a url'), false, 'garbage rejected');
}

// ── normaliseResultUrl ───────────────────────────────────────────
{
  eq(
    normaliseResultUrl('//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage&rut=abc'),
    'https://example.com/page',
    'unwraps the DuckDuckGo redirect'
  );
  eq(normaliseResultUrl('https://example.com/page#section'), 'https://example.com/page', 'drops the fragment');
  eq(normaliseResultUrl('//duckduckgo.com/l/?uddg=http%3A%2F%2F127.0.0.1%2F'), null, 'private target rejected');
  eq(normaliseResultUrl('/l/?uddg=javascript%3Aalert(1)'), null, 'javascript target rejected');
  eq(normaliseResultUrl('&#x2F;&#x2F;duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2F'), 'https://example.org/', 'entity-encoded href');
}

// ── entities / tags ──────────────────────────────────────────────
{
  eq(decodeEntities('Tom &amp; Jerry &lt;3 &#39;quotes&#39;'), `Tom & Jerry <3 'quotes'`, 'decodes entities');
  eq(stripTags('<b>Hello</b>   <i>world</i>'), 'Hello world', 'strips tags and collapses whitespace');
}

// ── parseDuckDuckGoHtml ──────────────────────────────────────────
const DDG_HTML = `
<div class="result results_links">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fone">First &amp; best</a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fone">A <b>useful</b> snippet.</a>
</div>
<div class="result results_links">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Ftwo">Second result</a>
  </h2>
  <a class="result__snippet">Another snippet.</a>
</div>
<div class="result results_links">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fone">Duplicate</a>
  </h2>
</div>
<div class="result result--ad">
  <h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=http%3A%2F%2F192.168.0.5%2F">Private</a></h2>
</div>
`;

{
  const hits = parseDuckDuckGoHtml(DDG_HTML, 8);
  eq(hits.length, 2, 'two unique, public results');
  eq(hits[0], { title: 'First & best', url: 'https://example.com/one', snippet: 'A useful snippet.' }, 'first hit parsed');
  eq(hits[1].url, 'https://example.org/two', 'second hit parsed');
  eq(parseDuckDuckGoHtml(DDG_HTML, 1).length, 1, 'honours the limit');
  eq(parseDuckDuckGoHtml('<html>nothing here</html>', 4), [], 'no results → empty');
}

// ── parseInstantAnswer ───────────────────────────────────────────
{
  const ok = parseInstantAnswer(JSON.stringify({
    Heading: 'Notion', AbstractText: 'Notion is a productivity app.', AbstractURL: 'https://en.wikipedia.org/wiki/Notion',
  }));
  eq(ok, { title: 'Notion', url: 'https://en.wikipedia.org/wiki/Notion', text: 'Notion is a productivity app.' }, 'instant answer parsed');
  eq(parseInstantAnswer(JSON.stringify({ AbstractText: '', AbstractURL: 'https://x.com' })), null, 'empty abstract → null');
  eq(parseInstantAnswer(JSON.stringify({ AbstractText: 'x', AbstractURL: 'http://127.0.0.1' })), null, 'private URL → null');
  eq(parseInstantAnswer('not json'), null, 'invalid JSON → null');
}

// ── parseWikipedia ───────────────────────────────────────────────
{
  const json = JSON.stringify({
    query: { pages: { '12345': { pageid: 12345, title: 'Rekursion', extract: 'Rekursion ist …' } } },
  });
  eq(
    parseWikipedia(json, 'de'),
    { title: 'Rekursion', url: 'https://de.wikipedia.org/?curid=12345', text: 'Rekursion ist …' },
    'wikipedia hit parsed'
  );
  eq(parseWikipedia(JSON.stringify({ query: { pages: { '-1': { title: 'x' } } } }), 'de'), null, 'missing extract → null');
  eq(parseWikipedia('{}', 'de'), null, 'no pages → null');
}

// ── buildQuery / buildContext ────────────────────────────────────
{
  eq(buildQuery('  what   is\nrecursion? '), 'what is recursion?', 'collapses whitespace');
  eq(buildQuery('explain ```const x = 1``` please'), 'explain please', 'drops code fences');
  eq(buildQuery('x'.repeat(600)).length, 400, 'query is length-capped');

  const context = buildContext([
    { title: 'A', url: 'https://a.example', text: 'Alpha' },
    { title: 'B', url: 'https://b.example', snippet: 'Bravo' },
    { title: 'C', url: 'https://c.example' },
  ]);
  eq(context.includes('[1] A\nhttps://a.example\nAlpha'), true, 'numbered source with text');
  eq(context.includes('[2] B\nhttps://b.example\nBravo'), true, 'falls back to the snippet');
  eq(context.includes('(no content available)'), true, 'placeholder when there is nothing');
}

// ── webSearch orchestration (stubbed fetch) ──────────────────────
function stubFetch(routes: Array<[RegExp, { status?: number; body: string }]>) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const hit = routes.find(([re]) => re.test(url));
    if (!hit) return new Response('not found', { status: 404 });
    return new Response(hit[1].body, { status: hit[1].status ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

async function orchestration() {
  {
    const { impl, calls } = stubFetch([
      [/html\.duckduckgo\.com/, { body: DDG_HTML }],
      [/api\.duckduckgo\.com/, { body: JSON.stringify({ Heading: 'Instant', AbstractText: 'Short abstract.', AbstractURL: 'https://abstract.example/x' }) }],
      [/r\.jina\.ai/, { body: 'Full page text.' }],
    ]);

    const result = await webSearch('what is recursion', { maxSources: 3, readPages: true, fetchImpl: impl });
    eq(result !== null, true, 'search produced a result');
    eq(result!.sources.length, 3, 'instant answer + two results');
    eq(result!.sources[0].url, 'https://abstract.example/x', 'instant answer leads');
    eq(result!.sources[1].text, 'Full page text.', 'result pages are read');
    eq(result!.sources[0].text, 'Short abstract.', 'instant answer keeps its own text (no extra read)');
    eq(calls.filter((u) => u.includes('r.jina.ai')).length, 2, 'reader called only for sources without text');
    eq(result!.context.startsWith('[1] Instant'), true, 'context is numbered in source order');
  }

  {
    // Progress phases drive the "Searching the web… / Reading sources…" status.
    const { impl } = stubFetch([
      [/html\.duckduckgo\.com/, { body: DDG_HTML }],
      [/api\.duckduckgo\.com/, { status: 500, body: '' }],
      [/r\.jina\.ai/, { body: 'Page text.' }],
    ]);
    const phases: string[] = [];
    await webSearch('anything', { readPages: true, fetchImpl: impl, onPhase: (p) => phases.push(p) });
    eq(phases, ['searching', 'reading'], 'searching then reading');

    const phasesNoRead: string[] = [];
    await webSearch('anything', { readPages: false, fetchImpl: impl, onPhase: (p) => phasesNoRead.push(p) });
    eq(phasesNoRead, ['searching'], 'no reading phase when pages are not read');
  }

  {
    // Search engines down → Wikipedia fallback.
    const { impl } = stubFetch([
      [/duckduckgo\.com/, { status: 503, body: 'nope' }],
      [/de\.wikipedia\.org/, { body: JSON.stringify({ query: { pages: { '7': { pageid: 7, title: 'Rekursion', extract: 'Rekursion ist …' } } } }) }],
    ]);
    const result = await webSearch('Rekursion', { maxSources: 4, readPages: false, fetchImpl: impl });
    eq(result?.sources.length, 1, 'wikipedia fallback used');
    eq(result?.sources[0].url, 'https://de.wikipedia.org/?curid=7', 'wikipedia source url');
  }

  {
    // Everything fails → null, so the turn simply runs without web context.
    const { impl } = stubFetch([[/.*/, { status: 500, body: 'boom' }]]);
    eq(await webSearch('anything', { fetchImpl: impl }), null, 'all providers failing → null');
    eq(await webSearch(' ', { fetchImpl: impl }), null, 'blank query → null (no requests)');
  }

  {
    // A disabled deployment never reaches the network.
    process.env.WEB_SEARCH_ENABLED = 'false';
    const { impl, calls } = stubFetch([[/.*/, { body: DDG_HTML }]]);
    eq(await webSearch('anything', { fetchImpl: impl }), null, 'disabled → null');
    eq(calls.length, 0, 'disabled → no HTTP calls');
    delete process.env.WEB_SEARCH_ENABLED;
  }
}

void orchestration().then(() => {
  console.log(`\nwebsearch: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
