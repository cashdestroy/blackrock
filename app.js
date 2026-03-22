const depopInput = document.querySelector('#depopInput');
const loadSampleBtn = document.querySelector('#loadSample');
const transformBtn = document.querySelector('#transformBtn');
const downloadBtn = document.querySelector('#downloadBtn');
const resultsEl = document.querySelector('#results');
const summaryEl = document.querySelector('#summary');
const cardTemplate = document.querySelector('#cardTemplate');

const addManualBtn = document.querySelector('#addManualBtn');
const clearManualBtn = document.querySelector('#clearManualBtn');
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

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
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
}

addManualBtn.addEventListener('click', () => {
  const listing = getManualListing();
  if (!listing.title) {
    summaryEl.textContent = '❌ Title is required for manual mode.';
    return;
  }
  upsertRows([toPoshmarkRow(listing)]);
  summaryEl.textContent = `Added manual listing: ${listing.title}`;
});

clearManualBtn.addEventListener('click', clearManualForm);

loadSampleBtn.addEventListener('click', () => {
  depopInput.value = JSON.stringify(sampleListings, null, 2);
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
