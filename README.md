# Depop → Poshmark Crosslister

A lightweight, no-backend web app for quickly cross-listing products from Depop to Poshmark.

## What it does

- Accepts a JSON array of Depop-style listings.
- Maps each listing to Poshmark-friendly fields.
- Suggests a Poshmark listing price based on fee-aware conversion.
- Runs quality checks (title length, description completeness, category confidence, photo count, etc.).
- Exports all converted listings as CSV for fast posting workflows.

## Run locally

Because this is a static site, you can run it with any basic file server:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Input shape (example)

```json
[
  {
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

## Notes

- There is no official public API integration included here for Depop/Poshmark account automation.
- This tool focuses on safer listing transformation/export to speed manual cross-listing.
