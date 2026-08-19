# Brand asset library

Every image used in a presentation lives here, and every presentation refers to
an image by its **id** — never by a copy of the file. That is what makes the
update rule work:

> Replace the file at an asset's `path`, keep the `id` the same, and every page
> in every presentation that uses it updates. Nothing has to be re-edited, and
> old versions never accumulate.

## Folder layout

```
public/assets/
  manifest.json
  vigo/
    product/        lifestyle/   recipes/   retail/   social/   packaging/
  alessi/
    product/        lifestyle/   recipes/   retail/   social/   packaging/
  corporate/
    ...
```

## Adding an image

1. Drop the file into the right brand + category folder.
2. Add one entry to `manifest.json`:

```json
{
  "id": "alessi-balsamic-front",
  "brand": "alessi",
  "category": "Product Photography",
  "name": "Balsamic Reduction — front",
  "path": "/assets/alessi/product/balsamic-front.jpg",
  "width": 2000,
  "height": 1333
}
```

3. Commit. The image appears in the builder's Assets panel immediately.

`brand` must be one of `vigo`, `alessi`, `corporate`.
`category` must be one of: Logos, Product Photography, Lifestyle, Recipes,
Retail, Social, Packaging, Backgrounds, Icons.

## Replacing an image (the important one)

A product's label changes — say *Asian Fusion* becomes *Sweet Chili Glaze*:

1. Save the new photograph over the **same path**, e.g.
   `/assets/vigo/product/asian-fusion.jpg`.
2. Optionally update the `name` in `manifest.json` so the Assets panel reads
   correctly. **Do not change the `id` or the `path`.**
3. Commit.

Every deck that used that image now shows the new one. There is no second copy
of the old label anywhere, because no presentation ever held a copy.

If you genuinely want both versions to coexist — for example a seasonal variant —
add it as a *new* asset with a new id and path instead.

## Retiring an image

Remove its entry from `manifest.json` and delete the file. Any presentation still
pointing at it falls back to whatever URL was stored when it was added, so
nothing breaks visually mid-meeting; re-point those pages when convenient.

## Sizing

Aim for 2000px on the long edge, JPEG, under about 500 KB. Full-bleed
backgrounds should be at least 2400px wide. The builder warns anyone who drops
in something too small to project cleanly.
