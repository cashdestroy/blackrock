const depopInput = document.querySelector('#depopInput');
const loadSampleBtn = document.querySelector('#loadSample');
const transformBtn = document.querySelector('#transformBtn');
const downloadBtn = document.querySelector('#downloadBtn');
const resultsEl = document.querySelector('#results');
const summaryEl = document.querySelector('#summary');
const cardTemplate = document.querySelector('#cardTemplate');

let transformedRows = [];

const sampleListings = [
  {
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
  {
    title: 'Nike ACG Fleece Hoodie',
    description: 'Warm hoodie, no holes, one tiny sleeve stain shown in photos.',
    price: 42,
    category: 'hoodie',
    brand: 'Nike',
    size: 'M',
    condition: 'fair',
    color: 'Black',
    images: ['https://example.com/images/acg-hoodie.jpg'],
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

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeSize(size = '') {
  const s = cleanText(size).toUpperCase();
  if (!s) return 'One Size';
  if (/\b(XS|S|M|L|XL|XXL)\b/.test(s)) return s.match(/\b(XS|S|M|L|XL|XXL)\b/)[0];
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
    warnings.push('Title is short. Use at least 20 characters for search visibility.');
  }
  if (row.description.length < 60) {
    score -= 20;
    warnings.push('Description is short. Add fit, flaws, fabric, and measurements.');
  }
  if (!row.brand || row.brand === 'Unknown') {
    score -= 15;
    warnings.push('Brand is missing. Add a clear brand for better buyer filters.');
  }
  if (row.category.startsWith('Uncategorized')) {
    score -= 15;
    warnings.push('Category mapping uncertain. Pick an exact Poshmark category.');
  }
  if (row.image_urls.split('|').length < 2) {
    score -= 10;
    warnings.push('Only one image URL detected. Add at least 2-4 photos.');
  }
  if (row.condition.toLowerCase() === 'fair') {
    score -= 10;
    warnings.push('Condition is fair. Mention flaws clearly to avoid returns.');
  }

  return {
    score: Math.max(0, score),
    warnings,
  };
}

function toPoshmarkRow(listing) {
  const title = cleanText(listing.title).slice(0, 80);
  const description = cleanText(listing.description);
  const price = recommendedPrice(listing.price);

  return {
    title,
    description,
    category: mapCategory(listing.category),
    size: normalizeSize(listing.size),
    brand: cleanText(listing.brand) || 'Unknown',
    original_price: Number(listing.price) || '',
    listing_price: price,
    color: cleanText(listing.color) || 'Not specified',
    condition: cleanText(listing.condition) || 'good',
    tags: `${cleanText(listing.brand)} ${cleanText(listing.category)} depop crosslist`.trim(),
    sku: `DEP-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    image_urls: Array.isArray(listing.images) ? listing.images.join('|') : '',
  };
}

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escaped = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(headers.map((h) => escaped(row[h])).join(','));
  }
  return lines.join('\n');
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => {
    window.prompt('Copy manually:', text);
  });
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

    const warningsEl = frag.querySelector('.warnings');
    warningsEl.innerHTML = warnings.length
      ? `⚠ ${warnings.join(' • ')}`
      : '✅ Listing looks ready for publishing.';

    frag.querySelector('.copyBtn').addEventListener('click', () => {
      copyText(JSON.stringify(row, null, 2));
    });

    resultsEl.appendChild(frag);
  });

  const avgScore = Math.round(
    rows.reduce((acc, row) => acc + scoreListing(row).score, 0) / Math.max(1, rows.length),
  );
  summaryEl.textContent = `Converted ${rows.length} listings • Average quality score: ${avgScore}/100`;
}

loadSampleBtn.addEventListener('click', () => {
  depopInput.value = JSON.stringify(sampleListings, null, 2);
});

transformBtn.addEventListener('click', () => {
  try {
    const raw = JSON.parse(depopInput.value);
    if (!Array.isArray(raw)) throw new Error('Input must be an array of listing objects.');

    transformedRows = raw.map(toPoshmarkRow);
    render(transformedRows);
    downloadBtn.disabled = transformedRows.length === 0;
  } catch (error) {
    summaryEl.textContent = `❌ ${error.message}`;
    resultsEl.innerHTML = '';
    downloadBtn.disabled = true;
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
