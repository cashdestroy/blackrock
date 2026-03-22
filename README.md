# Depop → Poshmark Crosslister

A lightweight web app for faster Depop-to-Poshmark cross-listing with **manual mode (no JSON required)** and optional bulk JSON mode.

## What changed

- ✅ Manual cross-list flow: paste a Depop URL, fill listing details, add image URLs, create a Poshmark-ready draft.
- ✅ Optional JSON flow still available for bulk conversions.
- ✅ “Open workflow” button opens Depop listing + Poshmark sell page in separate tabs.
- ✅ CSV export for all generated drafts.
- ✅ Quality scoring for listing completeness.

## Can it auto-login and post directly?

Not in this version.

Marketplaces often restrict automated login/posting behavior and change anti-bot rules frequently. This tool is designed for **safe assisted cross-listing**:

1. You log into Depop and Poshmark manually.
2. Use this app to standardize and prepare listing data quickly.
3. Click **Open workflow** and paste generated fields into Poshmark's create listing form.

## Run locally

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Input examples

### Manual mode
- Depop URL: `https://www.depop.com/products/...`
- Title, description, price, category, brand, size, condition, color
- Image URLs (one per line)

### JSON mode

```json
[
  {
    "depop_url": "https://www.depop.com/products/demo-vintage-levis-501/",
    "title": "Vintage Levi's 501 Jeans",
    "description": "Classic straight leg denim.",
    "price": 58,
    "category": "mens jeans",
    "brand": "Levi's",
    "size": "W32 L30",
    "condition": "good",
    "color": "Blue",
    "images": ["https://example.com/front.jpg", "https://example.com/back.jpg"]
  }
]
```
