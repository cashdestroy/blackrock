# TagTracker (Coded Prototype)

A fully coded starter app inspired by your Glide TagTracker concept.

## Features

- Account registration and login.
- Tag upload form (brand, style, year, notes, image URL).
- Searchable TagTracker grid.
- Favorites system per user.
- Forum posts with likes and comments.
- Top contributors panel.
- Theme customization (primary/background colors).
- Local persistence via `localStorage`.

## Run locally

Because this app uses ES modules, run it with a local server.

```bash
python -m http.server 4173
```

Then open:

- <http://localhost:4173>

## Next recommended upgrades

- Move auth and data to a real backend (Supabase/Firebase/Postgres API).
- Add image upload storage (S3/Supabase Storage/Cloudinary).
- Add moderation tools, reports, and role-based admin actions.
- Add tests (unit + e2e) and CI pipeline.
