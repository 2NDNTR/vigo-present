'use client';

import { useMemo, useState } from 'react';
import Stage from '@/components/render/Stage';
import { BRAND_ORDER, colorLabel, getTheme, type BrandId, type ColorRole, type TypeRole } from '@/lib/brand/themes';
import { createPage, templatesByCategory } from '@/lib/templates/registry';
import { BUDGET } from '@/lib/design/framework';

/**
 * THE DESIGN FRAMEWORK, AS A PAGE
 * The rules every deck answers to, each brand's type and colour, and every
 * approved layout drawn in that brand. It is the reference the assistant
 * works from, made visible to the team.
 */

const PRINCIPLES: { title: string; body: string }[] = [
  { title: 'One title per page', body: 'Each page makes one point, carried by one title. An eyebrow can sit above it and supporting copy below; a second title is demoted automatically.' },
  { title: 'Titles are uniform', body: 'A title is the size its layout designs: every cover title the same display size, every page title in a layout the same size. Each level of type has a length it can carry; a title that runs long gets shorter words, never smaller type.' },
  { title: 'The layout decides', body: 'Positions, sizes and spacing come from the approved layouts. Choose the layout that fits the content: cards for parallel ideas, metrics for figures, split for one idea and one picture.' },
  { title: 'Colour is an accent', body: 'Light pages are the default. Dark and photo pages mark openings, section breaks and closings. A coloured page is never next to another, and about one in four at most.' },
  { title: 'Pictures match', body: 'Items in a row share one kind of picture: all dishes, all products, or none. Logos are never photographs; they live on covers and logo pages.' },
  { title: 'Product pages are white', body: 'Product shots are packshots on white, so any page showing them is drawn on white and the shots sit cleanly, with no box around them. Colour goes on story, data and section pages instead.' },
  { title: 'Nothing left over', body: 'No sample words from a layout, no duplicate pages, no placeholder bullets. The assistant checks every deck for these.' },
];

const LADDER: TypeRole[] = ['display', 'headline', 'subhead', 'body', 'eyebrow'];
const SAMPLE: Partial<Record<TypeRole, string>> = {
  display: 'Built for the season',
  headline: 'Three ways to use white balsamic',
  subhead: 'Aged in Modena, reduced slowly, finished thick.',
  body: 'Founded in Tampa in 1947 and still family held. Every product is chosen by the people who eat it at home.',
  eyebrow: 'Since 1947',
};

export default function Framework() {
  const [brand, setBrand] = useState<BrandId>('alessi');
  const theme = getTheme(brand);
  const groups = useMemo(() => templatesByCategory(), []);
  const pages = useMemo(
    () => Object.fromEntries(groups.flatMap((g) => g.items).map((t) => [t.id, createPage(t.id, undefined, brand)])),
    [groups, brand]
  );
  const surfaces: { role: ColorRole; use: string }[] = [
    { role: theme.surface.bg, use: 'Default page' },
    { role: 'white', use: 'Light page' },
    { role: 'brandPrimary', use: 'Dark page: openings, breaks, closings' },
    { role: 'accent', use: 'Accent page: one at a time' },
  ];
  const font = (r: TypeRole) => (theme.type[r].family === 'display' ? theme.fonts.display : theme.fonts.body);

  return (
    <div className="fw">
      <div className="v2-head">
        <div>
          <h1 className="t-title">Design framework</h1>
          <p className="t-small">The rules every presentation follows, and every approved layout in each brand. The assistant works to this; the app enforces the mechanical parts on every edit.</p>
        </div>
      </div>

      <div className="seg2" role="group" aria-label="Brand" style={{ marginBottom: 28 }}>
        {BRAND_ORDER.map((b) => (
          <button key={b} aria-pressed={brand === b} onClick={() => setBrand(b)}>
            {getTheme(b).name}
          </button>
        ))}
      </div>

      <section className="fw-sec">
        <h2 className="t-section">Principles</h2>
        <ol className="fw-principles">
          {PRINCIPLES.map((p) => (
            <li key={p.title}>
              <b>{p.title}</b>
              <span>{p.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="fw-sec">
        <h2 className="t-section">Type</h2>
        <p className="t-small">Largest to smallest. The number is how many characters each level carries before it steps down.</p>
        <div className="fw-type" style={{ background: theme.colors[theme.surface.bg], color: theme.colors[theme.surface.ink] }}>
          {LADDER.map((r) => {
            const s = theme.type[r];
            return (
              <div key={r} className="fw-type-row">
                <span className="fw-type-meta">
                  {r}
                  <em>{BUDGET[r]} characters</em>
                </span>
                <span
                  style={{
                    fontFamily: font(r),
                    fontWeight: s.weight,
                    fontSize: Math.max(13, s.size * 0.42),
                    lineHeight: s.lineHeight,
                    textTransform: (s.transform as any) || 'none',
                  }}
                >
                  {SAMPLE[r]}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="fw-sec">
        <h2 className="t-section">Colour</h2>
        <div className="fw-colours">
          {surfaces.map((c) => (
            <div key={c.role} className="fw-colour">
              <i style={{ background: theme.colors[c.role] }} />
              <b>{colorLabel(theme, c.role)}</b>
              <span>{c.use}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="fw-sec">
        <h2 className="t-section">Layouts</h2>
        <p className="t-small">Every approved layout, drawn in {theme.name}. Pick by what the content is, not how it should look.</p>
        {groups.map((g) => (
          <div key={g.category} className="fw-cat">
            <h3>{g.category}</h3>
            <div className="fw-grid">
              {g.items.map((t) => (
                <figure key={t.id} className="fw-layout" data-layout={t.id}>
                  <div className="fw-stage">
                    <Stage page={pages[t.id]} brand={brand} mode="fixed" />
                  </div>
                  <figcaption>
                    <b>{t.name}</b>
                    <span>{t.hint}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
