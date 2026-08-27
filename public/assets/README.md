# Brand asset library

Every image and video used in a presentation lives here, and every presentation
refers to an asset by its **id** — never by a copy of the file. That is what
makes the update rule work:

> Replace the file at an asset's path, keep the filename the same, and every
> page in every presentation that uses it updates. Nothing is re-edited, and old
> versions never accumulate.

## Where to put files

```
public/assets/
  vigo/          alessi/        corporate/
    product/       product/       product/
    lifestyle/     lifestyle/     lifestyle/
    recipes/       recipes/       recipes/
    retail/        retail/        retail/
    social/        social/        social/
    packaging/     packaging/     packaging/
    backgrounds/   backgrounds/   backgrounds/
```

Drop a JPG, PNG, WEBP, SVG or MP4 into the right brand + category folder.
That is the whole job — the folder path decides the brand and the category, and
the filename becomes the label shown in the Assets panel.

`vigo/backgrounds/tuscan-table.jpg` becomes **"Tuscan Table"**, filed under
Vigo → Backgrounds.

## Then regenerate the index

```bash
npm run assets
```

That rewrites `manifest.json` from what is actually on disk. **Never hand-edit
`manifest.json`** — it is generated, and your edits will be overwritten. The
portable build runs this automatically.

## Naming

Use lowercase words separated by hyphens: `endcap-display.jpg`,
`balsamic-front.jpg`, `family-table-evening.jpg`. The name is what people search
for in the Assets panel, so make it describe the picture, not the file.

## Replacing an image (the important one)

A product's label changes — say *Asian Fusion* becomes *Sweet Chili Glaze*:

1. Save the new photograph over the **same filename**, e.g.
   `vigo/product/asian-fusion.jpg`.
2. Rename the file only if you also want the label in the panel to change —
   but be aware that renaming creates a *new* asset, and pages pointing at the
   old one keep the old picture.
3. Run `npm run assets` and commit.

Every deck that used that image now shows the new one. There is no second copy
of the old label anywhere, because no presentation ever held a copy.

If you want both versions to coexist — a seasonal variant, say — add it under a
new filename instead.

## Sizing

Aim for 2000px on the long edge, JPEG, under about 500 KB. Full-bleed
backgrounds should be at least 2400px wide. The builder warns anyone who drops
in something too small to project cleanly.
