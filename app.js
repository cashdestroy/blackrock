const depopInput = document.querySelector('#depopInput');
const loadSampleBtn = document.querySelector('#loadSample');
const transformBtn = document.querySelector('#transformBtn');
const downloadBtn = document.querySelector('#downloadBtn');
const clearDraftsBtn = document.querySelector('#clearDraftsBtn');
const resultsEl = document.querySelector('#results');
const summaryEl = document.querySelector('#summary');
const cardTemplate = document.querySelector('#cardTemplate');

const addManualBtn = document.querySelector('#addManualBtn');
const clearManualBtn = document.querySelector('#clearManualBtn');
const autofillBtn = document.querySelector('#autofillBtn');
const autofillStatus = document.querySelector('#autofillStatus');
const debugOutput = document.querySelector('#debugOutput');
const rawHtmlInput = document.querySelector('#rawHtmlInput');
const parsePastedBtn = document.querySelector('#parsePastedBtn');
const manualFields = {
  depop_url: document.querySelector('#manualDepopUrl'),
  title: document.querySelector('#manualTitle'),
  description: document.querySelector('#manualDescription'),
  price: document.querySelector('#manualPrice'),
  category: document.querySelector('#manualCategory'),
  brand: document.querySelector('#manualBrand'),
  size: document.querySelector('#manualSize'),
  condition: document.querySelector('#manualCondition'),
  color: document.querySelector('#manualColor'),
  images: document.querySelector('#manualImages'),
};

let transformedRows = [];
const STORAGE_KEY = 'depop_poshmark_crosslister_v1';

const sampleListings = [
  {
    depop_url: 'https://www.depop.com/products/demo-vintage-levis-501/',
    title: 'Vintage Levi\'s 501 Jeans',
    description: 'Classic straight leg denim. Great wash, minor wear near hem.',
    price: 58,
    category: 'mens jeans',
    brand: 'Levi\'s',
    size: 'W32 L30',
    condition: 'good',
    color: 'Blue',
    images: [
      'https://example.com/images/levis-front.jpg',
      'https://example.com/images/levis-back.jpg',
    ],
  },
];

const categoryMap = {
  jeans: 'Men / Pants / Jeans',
  hoodie: 'Men / Tops / Sweatshirts & Hoodies',
  sneakers: 'Men / Shoes / Sneakers',
  dress: 'Women / Dresses / Casual',
  skirt: 'Women / Skirts / Mini',
  tee: 'Women / Tops / Tees - Short Sleeve',
};


function extractFirst(doc, selectors) {
  for (const selector of selectors) {
    const node = doc.querySelector(selector);
    if (node?.content) return cleanText(node.content);
    if (node?.textContent) return cleanText(node.textContent);
  }
  return '';
}

function decodeEscapedString(value = '') {
  try {
    return JSON.parse(`"${String(value).replace(/"/g, '\\"')}"`);
  } catch {
    return String(value);
  }
}

function findKeyStringValues(html, key) {
  const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'gi');
  const values = [];
  for (const match of html.matchAll(pattern)) {
    const text = cleanText(decodeEscapedString(match[1]));
    if (text) values.push(text);
  }
  return values;
}

function findKeyNumberValues(html, key) {
  const pattern = new RegExp(`"${key}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'gi');
  const values = [];
  for (const match of html.matchAll(pattern)) {
    const num = Number(match[1]);
    if (!Number.isNaN(num)) values.push(num);
  }
  return values;
}

function stripTags(value = '') {
  return cleanText(String(value).replace(/<[^>]*>/g, ' '));
}

function findLabelValue(html, labels) {
  for (const label of labels) {
    const patterns = [
      new RegExp(`${label}\\s*[:\\-]\\s*([^\\n\\r<|]{1,80})`, 'i'),
      new RegExp(`${label}\\s*</[^>]+>\\s*<[^>]+>\\s*([^<]{1,80})`, 'i'),
      new RegExp(`${label}\\s*\\n\\s*([^\\n\\r]{1,80})`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const value = stripTags(match[1]);
        if (value) return value;
      }
    }
  }
  return '';
}

function firstNonEmpty(candidates = []) {
  for (const candidate of candidates) {
    if (candidate?.value) return candidate;
  }
  return { value: '', source: 'none' };
}

function sanitizeToken(value = '') {
  return cleanText(
    String(value)
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/<[^>]*>/g, ' ')
      .replace(/[{}[\]\\"]/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

function pickCleanShortValue(raw = '', { maxLen = 50, allow = /^[a-z0-9 '&/+-]+$/i } = {}) {
  const candidates = String(raw)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '$1')
    .replace(/[*_`]/g, ' ')
    .split(/[,|;/>\n\r]+/)
    .map((part) => sanitizeToken(part).trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.length < 2 || candidate.length > maxLen) continue;
    if (!allow.test(candidate)) continue;
    if (/^(sale|shop|items?|view|more|see more)$/i.test(candidate)) continue;
    if (/(https?:\/\/|www\.|depop\.com)/i.test(candidate)) continue;
    if (/^(tops?|bottoms?|mens?|womens?|kids?)$/i.test(candidate)) continue;
    return candidate;
  }
  return '';
}

function extractImagesFromHtml(html, doc) {
  const ogImages = [...doc.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')]
    .map((node) => cleanText(node.content))
    .filter(Boolean);

  const jsonLdMatches = [...html.matchAll(/"image"\s*:\s*(\[[^\]]+\]|"[^"]+")/g)]
    .map((match) => match[1])
    .flatMap((raw) => {
      if (raw.startsWith('[')) {
        return [...raw.matchAll(/"(https?:\/\/[^"\\]+)"/g)].map((m) => m[1].replace(/\\\//g, '/'));
      }
      return [raw.replaceAll('"', '').replace(/\\\//g, '/')];
    });

  return [...new Set([...ogImages, ...jsonLdMatches].filter(Boolean))].slice(0, 16);
}

function inferSize(text) {
  const haystack = text.toUpperCase();
  const letter = haystack.match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b/);
  if (letter) return letter[1];
  const waist = haystack.match(/\bW\s?(\d{2})\b/);
  if (waist) return `W${waist[1]}`;
  const shoe = haystack.match(/\b(?:SIZE\s*)?(\d{1,2}(?:\.5)?)\b/);
  return shoe ? shoe[1] : '';
}

function pickBestDescription(html, doc) {
  const metaDescription = extractFirst(doc, ['meta[property="og:description"]', 'meta[name="description"]']);
  const structuredDescriptions = [
    ...findKeyStringValues(html, 'description'),
    ...findKeyStringValues(html, 'fullDescription'),
    ...findKeyStringValues(html, 'body'),
  ].filter((value) => value.length > 30);

  const bestStructured = structuredDescriptions.sort((a, b) => b.length - a.length)[0] || '';
  return bestStructured || metaDescription;
}

function pickBestTitle(html, doc) {
  const metaTitle = extractFirst(doc, ['meta[property="og:title"]', 'title']);
  const structuredTitles = [
    ...findKeyStringValues(html, 'title'),
    ...findKeyStringValues(html, 'name'),
  ].filter((value) => value.length > 5 && value.length < 120);

  const bestStructured = structuredTitles.sort((a, b) => b.length - a.length)[0] || '';
  return bestStructured || metaTitle;
}

function pickBrand(html) {
  const brands = [
    ...findKeyStringValues(html, 'brand'),
    ...findKeyStringValues(html, 'brandName'),
  ].filter((value) => value.length > 1 && value.length < 50);
  const raw = brands[0] || findLabelValue(html, ['brand', 'designer', 'make']);
  return pickCleanShortValue(raw, { maxLen: 40 });
}

function pickCategory(html) {
  const categories = [
    ...findKeyStringValues(html, 'category'),
    ...findKeyStringValues(html, 'categoryName'),
    ...findKeyStringValues(html, 'department'),
  ].filter((value) => value.length > 1 && value.length < 80);
  const raw = categories[0] || findLabelValue(html, ['category', 'department']);
  return pickCleanShortValue(raw, { maxLen: 60 });
}

function pickSize(html, title, description) {
  const sizeCandidates = [
    ...findKeyStringValues(html, 'size'),
    ...findKeyStringValues(html, 'sizeText'),
    ...findKeyStringValues(html, 'sizeLabel'),
  ];

  for (const candidate of sizeCandidates) {
    const normalized = normalizeSize(candidate);
    if (normalized && normalized !== 'One Size') return normalized;
  }

  const labeled = findLabelValue(html, ['size', 'tagged size', 'fits like']);
  if (labeled) {
    const normalized = normalizeSize(labeled);
    if (normalized && normalized !== 'One Size') return normalized;
  }
  if ((title || '').length < 8 && (description || '').length < 16) return '';
  return inferSize(`${title} ${description} ${labeled}`);
}

function pickPrice(html) {
  const stringPrices = [
    ...findKeyStringValues(html, 'price'),
    ...findKeyStringValues(html, 'formattedPrice'),
    ...findKeyStringValues(html, 'displayPrice'),
  ]
    .map((value) => Number(value.replace(/[^0-9.]/g, '')))
    .filter((value) => !Number.isNaN(value) && value > 0);

  const labeledPrice = Number((findLabelValue(html, ['price', 'listing price']) || '').replace(/[^0-9.]/g, ''));

  const prices = [
    ...stringPrices,
    ...findKeyNumberValues(html, 'price'),
    ...findKeyNumberValues(html, 'priceAmount'),
    ...findKeyNumberValues(html, 'amount'),
    labeledPrice,
  ].filter((value) => value > 0 && value < 50000);
  return prices[0] || 0;
}

function pickColor(html) {
  const colors = [
    ...findKeyStringValues(html, 'color'),
    ...findKeyStringValues(html, 'colour'),
    ...findKeyStringValues(html, 'colorName'),
  ].filter((value) => value.length > 1 && value.length < 50);

  const raw = colors[0] || findLabelValue(html, ['color', 'colour']);
  return pickCleanShortValue(raw, { maxLen: 30 });
}

async function fetchDepopRawHtml(depopUrl) {
  const targets = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(depopUrl)}`,
    `https://r.jina.ai/http://${depopUrl.replace(/^https?:\/\//, '')}`,
  ];

  let lastError = null;
  for (const url of targets) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text && text.length > 100) return text;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Unable to fetch Depop listing data.');
}

function normalizeDepopProductUrl(url = '') {
  const cleaned = cleanText(url);
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned);
    parsed.search = '';
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/\/manage\/?$/i, '/');
    return parsed.toString();
  } catch {
    return cleaned.replace(/\/manage\/?$/i, '/');
  }
}

function detectBlockedFetch(html = '', title = '') {
  const sample = `${title} ${html.slice(0, 4000)}`.toLowerCase();
  return (
    sample.includes('just a moment') ||
    sample.includes('attention required') ||
    sample.includes('cf-challenge') ||
    sample.includes('cloudflare') ||
    sample.includes('captcha')
  );
}

function extractFieldsFromHtml(html, depopUrl = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const titleChoice = firstNonEmpty([
    { value: pickBestTitle(html, doc), source: 'meta/structured title parser' },
    { value: extractFirst(doc, ['meta[property="og:title"]', 'title']), source: 'meta:title fallback' },
  ]);
  const descriptionChoice = firstNonEmpty([
    { value: pickBestDescription(html, doc), source: 'structured/full description parser' },
    { value: extractFirst(doc, ['meta[property="og:description"]', 'meta[name="description"]']), source: 'meta description fallback' },
  ]);
  const imagesChoice = {
    value: extractImagesFromHtml(html, doc),
    source: 'og:image + structured image parser',
  };
  const sizeChoice = firstNonEmpty([
    { value: pickSize(html, titleChoice.value, descriptionChoice.value), source: 'size keys + label/inference parser' },
    { value: findLabelValue(html, ['size', 'tagged size']), source: 'label fallback (size)' },
  ]);
  const brandChoice = firstNonEmpty([
    { value: pickBrand(html), source: 'brand keys + label parser' },
    { value: findLabelValue(html, ['brand']), source: 'label fallback (brand)' },
  ]);
  const categoryChoice = firstNonEmpty([
    { value: pickCategory(html), source: 'category keys + label parser' },
    { value: findLabelValue(html, ['category']), source: 'label fallback (category)' },
  ]);
  const priceChoice = firstNonEmpty([
    { value: pickPrice(html), source: 'numeric/string price parser' },
    { value: Number((findLabelValue(html, ['price']) || '').replace(/[^0-9.]/g, '')), source: 'label fallback (price)' },
  ]);
  const colorChoice = firstNonEmpty([
    { value: pickColor(html), source: 'color keys + label parser' },
    { value: findLabelValue(html, ['color', 'colour']), source: 'label fallback (color)' },
  ]);

  return {
    depopUrl,
    html,
    titleChoice,
    descriptionChoice,
    imagesChoice,
    sizeChoice,
    brandChoice,
    categoryChoice,
    priceChoice,
    colorChoice,
  };
}

function applyExtractedFields(result, sourceLabel) {
  const {
    depopUrl,
    html,
    titleChoice,
    descriptionChoice,
    imagesChoice,
    sizeChoice,
    brandChoice,
    categoryChoice,
    priceChoice,
    colorChoice,
  } = result;

  if (detectBlockedFetch(html, titleChoice.value)) {
    debugOutput.textContent = JSON.stringify(
      {
        url: depopUrl,
        source: sourceLabel,
        blocked: true,
        detected_title: titleChoice.value || null,
        note: 'Depop/Cloudflare bot check blocked content extraction from this proxy response.',
        next_steps: [
          'Open the public product URL in your browser (not /manage/).',
          'Use the paste-content fallback below by pasting page source/text.',
          'Try again later; anti-bot challenge pages are transient.',
        ],
      },
      null,
      2,
    );
    autofillStatus.textContent =
      '❌ Depop returned an anti-bot page (“Just a moment”). Try “Parse pasted content” fallback.';
    return false;
  }

  if (titleChoice.value) manualFields.title.value = titleChoice.value;
  if (descriptionChoice.value) manualFields.description.value = descriptionChoice.value;
  if (imagesChoice.value.length) manualFields.images.value = imagesChoice.value.join('\n');
  const normalizedSize = normalizeSize(sizeChoice.value);
  if (normalizedSize && normalizedSize !== 'One Size') manualFields.size.value = normalizedSize;
  if (brandChoice.value) manualFields.brand.value = brandChoice.value;
  if (categoryChoice.value) manualFields.category.value = categoryChoice.value;
  if (priceChoice.value) manualFields.price.value = String(Math.round(Number(priceChoice.value)));
  if (colorChoice.value) manualFields.color.value = colorChoice.value;

  const debugData = {
    url: depopUrl,
    source: sourceLabel,
    fetched_html_length: html.length,
    fields: {
      title: { source: titleChoice.source, value: titleChoice.value || null },
      description: {
        source: descriptionChoice.source,
        length: descriptionChoice.value?.length || 0,
        preview: descriptionChoice.value?.slice(0, 160) || null,
      },
      images: {
        source: imagesChoice.source,
        count: imagesChoice.value.length,
        first_two: imagesChoice.value.slice(0, 2),
      },
      size: { source: sizeChoice.source, value: sizeChoice.value || null },
      brand: { source: brandChoice.source, value: brandChoice.value || null },
      category: { source: categoryChoice.source, value: categoryChoice.value || null },
      price: { source: priceChoice.source, value: priceChoice.value || null },
      color: { source: colorChoice.source, value: colorChoice.value || null },
    },
    note: 'If a field is null, parser could not locate it in the provided content.',
  };
  debugOutput.textContent = JSON.stringify(debugData, null, 2);
  autofillStatus.textContent =
    '✅ Autofilled title, full description (when available), photos, size, brand, category, price, and color. Review/edit before adding draft.';
  return true;
}

async function autofillFromDepopUrl() {
  const depopUrl = normalizeDepopProductUrl(manualFields.depop_url.value);
  if (!depopUrl) {
    autofillStatus.textContent = '❌ Add a Depop listing URL first.';
    return;
  }
  manualFields.depop_url.value = depopUrl;

  autofillStatus.textContent = 'Fetching listing details from Depop link...';
  autofillBtn.disabled = true;
  ['brand', 'category', 'size', 'color'].forEach((field) => {
    manualFields[field].value = '';
  });

  try {
    const html = await fetchDepopRawHtml(depopUrl);
    const result = extractFieldsFromHtml(html, depopUrl);
    applyExtractedFields(result, 'proxy fetch');
  } catch (error) {
    autofillStatus.textContent = `❌ Could not auto-read this link (${error.message}). You can still fill manually.`;
    debugOutput.textContent = JSON.stringify(
      {
        url: depopUrl,
        error: error.message,
        note: 'Try a public product URL (not /manage/) or use "Parse pasted content" fallback.',
      },
      null,
      2,
    );
  } finally {
    autofillBtn.disabled = false;
  }
}

function parsePastedContent() {
  const pasted = rawHtmlInput.value.trim();
  if (!pasted) {
    autofillStatus.textContent = '❌ Paste page HTML/text first, then click Parse pasted content.';
    return;
  }
  ['brand', 'category', 'size', 'color'].forEach((field) => {
    manualFields[field].value = '';
  });
  const depopUrl = normalizeDepopProductUrl(manualFields.depop_url.value);
  const result = extractFieldsFromHtml(pasted, depopUrl);
  applyExtractedFields(result, 'pasted content');
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function getManualFormSnapshot() {
  return {
    depop_url: manualFields.depop_url.value,
    title: manualFields.title.value,
    description: manualFields.description.value,
    price: manualFields.price.value,
    category: manualFields.category.value,
    brand: manualFields.brand.value,
    size: manualFields.size.value,
    condition: manualFields.condition.value,
    color: manualFields.color.value,
    images: manualFields.images.value,
    raw_html: rawHtmlInput.value,
  };
}

function applyManualFormSnapshot(snapshot = {}) {
  manualFields.depop_url.value = snapshot.depop_url || '';
  manualFields.title.value = snapshot.title || '';
  manualFields.description.value = snapshot.description || '';
  manualFields.price.value = snapshot.price || '';
  manualFields.category.value = snapshot.category || '';
  manualFields.brand.value = snapshot.brand || '';
  manualFields.size.value = snapshot.size || '';
  manualFields.condition.value = snapshot.condition || 'good';
  manualFields.color.value = snapshot.color || '';
  manualFields.images.value = snapshot.images || '';
  rawHtmlInput.value = snapshot.raw_html || '';
}

function saveState() {
  const payload = {
    manual: getManualFormSnapshot(),
    transformedRows,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    applyManualFormSnapshot(parsed.manual || {});
    if (Array.isArray(parsed.transformedRows) && parsed.transformedRows.length) {
      transformedRows = parsed.transformedRows;
      render(transformedRows);
      downloadBtn.disabled = false;
      summaryEl.textContent = `Restored ${transformedRows.length} saved draft(s).`;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function normalizeSize(size = '') {
  const s = cleanText(size).toUpperCase();
  if (!s) return 'One Size';
  if (/(XXS|XS|S|M|L|XL|XXL|XXXL)/.test(s)) return s.match(/(XXS|XS|S|M|L|XL|XXL|XXXL)/)[0];
  if (/W\d+/.test(s)) return s.match(/W\d+/)[0];
  if (/\b\d{1,2}(\.5)?\b/.test(s)) return s.match(/\b\d{1,2}(\.5)?\b/)[0];
  return s;
}

function mapCategory(rawCategory = '') {
  const normalized = cleanText(rawCategory).toLowerCase();
  for (const key of Object.keys(categoryMap)) {
    if (normalized.includes(key)) return categoryMap[key];
  }
  return 'Uncategorized / Review Needed';
}

function recommendedPrice(depopPrice) {
  const base = Number(depopPrice) || 0;
  const poshSellerNetTarget = base * 0.9;
  const priceBeforeFee = poshSellerNetTarget / 0.8;
  return Math.max(3, Math.round(priceBeforeFee));
}

function scoreListing(row) {
  let score = 100;
  const warnings = [];

  if (row.title.length < 20) {
    score -= 20;
    warnings.push('Title is short. Use at least 20 characters.');
  }
  if (row.description.length < 60) {
    score -= 20;
    warnings.push('Description is short. Add flaws, measurements, and fabric.');
  }
  if (!row.brand || row.brand === 'Unknown') {
    score -= 15;
    warnings.push('Brand is missing. Add a brand for better filters.');
  }
  if (row.category.startsWith('Uncategorized')) {
    score -= 15;
    warnings.push('Category mapping uncertain. Pick exact Poshmark category.');
  }
  if (row.image_urls.split('|').filter(Boolean).length < 2) {
    score -= 10;
    warnings.push('Fewer than 2 image URLs. Add more photos.');
  }
  if (!row.depop_url) {
    score -= 5;
    warnings.push('Depop URL missing. Add it for easier side-by-side workflow.');
  }

  return { score: Math.max(0, score), warnings };
}

function toPoshmarkRow(listing) {
  const title = cleanText(listing.title).slice(0, 80);
  const description = cleanText(listing.description);

  return {
    depop_url: cleanText(listing.depop_url),
    title,
    description,
    category: mapCategory(listing.category),
    size: normalizeSize(listing.size),
    brand: cleanText(listing.brand) || 'Unknown',
    original_price: Number(listing.price) || '',
    listing_price: recommendedPrice(listing.price),
    color: cleanText(listing.color) || 'Not specified',
    condition: cleanText(listing.condition) || 'good',
    tags: `${cleanText(listing.brand)} ${cleanText(listing.category)} depop crosslist`.trim(),
    sku: `DEP-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    image_urls: Array.isArray(listing.images)
      ? listing.images.join('|')
      : cleanText(listing.images || ''),
    poshmark_sell_url: 'https://poshmark.com/create-listing',
  };
}

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(',')),
  ].join('\n');
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => window.prompt('Copy manually:', text));
}

function buildFormattedText(row) {
  return `Title: ${row.title}\nPrice: $${row.listing_price}\nCategory: ${row.category}\nSize: ${row.size}\nBrand: ${row.brand}\nCondition: ${row.condition}\nColor: ${row.color}\nDescription: ${row.description}\nImage URLs: ${row.image_urls}`;
}

function render(rows) {
  resultsEl.innerHTML = '';
  rows.forEach((row) => {
    const { score, warnings } = scoreListing(row);
    const frag = cardTemplate.content.cloneNode(true);

    frag.querySelector('.title').textContent = row.title;
    const scoreEl = frag.querySelector('.score');
    scoreEl.textContent = `Quality score: ${score}/100`;
    scoreEl.className = `score ${score >= 80 ? 'good' : score >= 60 ? 'warn' : 'bad'}`;

    const fieldsEl = frag.querySelector('.fields');
    Object.entries(row).forEach(([key, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = value;
      fieldsEl.append(dt, dd);
    });

    frag.querySelector('.warnings').textContent = warnings.length
      ? `⚠ ${warnings.join(' • ')}`
      : '✅ Listing looks ready for publishing.';

    frag.querySelector('.copyBtn').addEventListener('click', () => copyText(JSON.stringify(row, null, 2)));
    frag.querySelector('.copyTextBtn').addEventListener('click', () => copyText(buildFormattedText(row)));
    frag.querySelector('.openFlowBtn').addEventListener('click', () => {
      if (row.depop_url) window.open(row.depop_url, '_blank', 'noopener,noreferrer');
      window.open(row.poshmark_sell_url, '_blank', 'noopener,noreferrer');
    });

    resultsEl.appendChild(frag);
  });

  const avgScore = Math.round(rows.reduce((acc, row) => acc + scoreListing(row).score, 0) / rows.length);
  summaryEl.textContent = `Converted ${rows.length} listings • Average quality score: ${avgScore}/100`;
}

function upsertRows(newRows) {
  transformedRows = [...transformedRows, ...newRows];
  render(transformedRows);
  downloadBtn.disabled = transformedRows.length === 0;
  saveState();
}

function getManualListing() {
  const images = manualFields.images.value
    .split('\n')
    .map((line) => cleanText(line))
    .filter(Boolean);

  return {
    depop_url: cleanText(manualFields.depop_url.value),
    title: cleanText(manualFields.title.value),
    description: cleanText(manualFields.description.value),
    price: Number(manualFields.price.value || 0),
    category: cleanText(manualFields.category.value),
    brand: cleanText(manualFields.brand.value),
    size: cleanText(manualFields.size.value),
    condition: cleanText(manualFields.condition.value),
    color: cleanText(manualFields.color.value),
    images,
  };
}

function clearManualForm() {
  Object.values(manualFields).forEach((el) => {
    if (el.tagName === 'SELECT') {
      el.value = 'good';
    } else {
      el.value = '';
    }
  });
  rawHtmlInput.value = '';
  saveState();
}

addManualBtn.addEventListener('click', () => {
  const listing = getManualListing();
  if (!listing.title) {
    summaryEl.textContent = '❌ Title is required for manual mode.';
    return;
  }
  upsertRows([toPoshmarkRow(listing)]);
  summaryEl.textContent = `Added manual listing: ${listing.title}`;
  saveState();
});

clearManualBtn.addEventListener('click', clearManualForm);
autofillBtn.addEventListener('click', autofillFromDepopUrl);
parsePastedBtn.addEventListener('click', parsePastedContent);
clearDraftsBtn.addEventListener('click', () => {
  transformedRows = [];
  resultsEl.innerHTML = '';
  summaryEl.textContent = 'Cleared all saved drafts.';
  downloadBtn.disabled = true;
  localStorage.removeItem(STORAGE_KEY);
});

loadSampleBtn.addEventListener('click', () => {
  depopInput.value = JSON.stringify(sampleListings, null, 2);
  saveState();
});

transformBtn.addEventListener('click', () => {
  try {
    const raw = JSON.parse(depopInput.value);
    if (!Array.isArray(raw)) throw new Error('Input must be an array of listing objects.');
    upsertRows(raw.map(toPoshmarkRow));
  } catch (error) {
    summaryEl.textContent = `❌ ${error.message}`;
  }
});

downloadBtn.addEventListener('click', () => {
  const csv = toCSV(transformedRows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'poshmark-crosslist.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

Object.values(manualFields).forEach((el) => {
  el.addEventListener('input', saveState);
  el.addEventListener('change', saveState);
});
rawHtmlInput.addEventListener('input', saveState);
depopInput.addEventListener('input', saveState);

loadState();
