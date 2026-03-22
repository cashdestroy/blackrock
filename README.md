# Depop → Poshmark Crosslister

A lightweight web app for faster Depop-to-Poshmark cross-listing with **manual mode (no JSON required)** and optional bulk JSON mode.

## What changed

- ✅ Manual cross-list flow: paste a Depop URL and click **Autofill from link** to pull title, description, and image URLs (best effort), then edit before saving.
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
- Paste Depop URL and click **Autofill from link** to prefill title/description/images
- Edit title, description, size, price, and all other fields before adding draft

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


## Autofill notes

- Autofill from link works by trying public fetch proxies and parsing metadata (`og:title`, `og:description`, `og:image`) from the Depop listing page.
- Because third-party sites can block scraping or change markup, autofill is best-effort and fields remain editable.
