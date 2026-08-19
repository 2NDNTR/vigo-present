import type { BrandId } from '@/lib/brand/themes';
import type { Presentation } from '@/lib/model/types';
import { slugify, uid } from '@/lib/model/types';
import { createPage } from './registry';

export interface StarterStep {
  templateId: string;
  section?: string;
}

export interface StarterDeck {
  id: string;
  name: string;
  description: string;
  pageCount: string;
  steps: StarterStep[];
}

export const STARTERS: StarterDeck[] = [
  {
    id: 'blank',
    name: 'Start from a cover',
    description: 'One cover page. Add everything else yourself.',
    pageCount: '1 page',
    steps: [{ templateId: 'cover', section: 'Opening' }],
  },
  {
    id: 'retail',
    name: 'Retail Sales Deck',
    description: 'The standard buyer meeting: brand, footprint, performance, products, support.',
    pageCount: '12 pages',
    steps: [
      { templateId: 'cover', section: 'Opening' },
      { templateId: 'brand-statement' },
      { templateId: 'image-copy', section: 'The Brand' },
      { templateId: 'timeline' },
      { templateId: 'retail-footprint', section: 'Performance' },
      { templateId: 'sales-growth' },
      { templateId: 'metric-three' },
      { templateId: 'hero-product', section: 'Products' },
      { templateId: 'product-family' },
      { templateId: 'social-growth', section: 'Marketing' },
      { templateId: 'key-takeaways', section: 'Closing' },
      { templateId: 'contact' },
    ],
  },
  {
    id: 'recap',
    name: 'Marketing Recap',
    description: 'Campaign objectives, creative, social and paid results, learnings, next steps.',
    pageCount: '11 pages',
    steps: [
      { templateId: 'cover', section: 'Opening' },
      { templateId: 'image-headline', section: 'The Campaign' },
      { templateId: 'key-takeaways' },
      { templateId: 'campaign-performance', section: 'Creative' },
      { templateId: 'social-screens' },
      { templateId: 'social-growth', section: 'Results' },
      { templateId: 'engagement' },
      { templateId: 'reach-impressions' },
      { templateId: 'influencer-results' },
      { templateId: 'key-takeaways', section: 'Closing' },
      { templateId: 'contact' },
    ],
  },
  {
    id: 'brand',
    name: 'Brand Presentation',
    description: 'Heritage, mission, portfolio, consumer, retail and partnership story.',
    pageCount: '11 pages',
    steps: [
      { templateId: 'cover', section: 'Opening' },
      { templateId: 'brand-statement' },
      { templateId: 'image-copy', section: 'Heritage' },
      { templateId: 'timeline' },
      { templateId: 'quote' },
      { templateId: 'product-family', section: 'Portfolio' },
      { templateId: 'hero-product' },
      { templateId: 'retail-footprint', section: 'Retail' },
      { templateId: 'key-accounts' },
      { templateId: 'social-growth', section: 'Marketing' },
      { templateId: 'thank-you', section: 'Closing' },
    ],
  },
];

export function buildPresentation(opts: {
  title: string;
  brand: BrandId;
  starterId: string;
  createdBy: string;
  orgId?: string;
}): Presentation {
  const starter = STARTERS.find((s) => s.id === opts.starterId) || STARTERS[0];
  const now = Date.now();
  const pages = starter.steps.map((step) => createPage(step.templateId, step.section));
  return {
    id: uid('pres'),
    orgId: opts.orgId || 'vigo-importing',
    title: opts.title,
    brand: opts.brand,
    status: 'draft',
    share: {
      slug: slugify(opts.title) + '-' + Math.random().toString(36).slice(2, 6),
      access: 'public',
      mode: 'scroll',
    },
    pages,
    createdBy: opts.createdBy,
    createdAt: now,
    updatedAt: now,
  };
}
