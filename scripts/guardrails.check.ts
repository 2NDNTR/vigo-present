/**
 * Regression check for the layout guardrails.
 *
 * Every case below is a page that was actually built in the Alessi Q4 deck and
 * silently broke on the stage — a metric row knocked off its baseline, a
 * checklist running under its own heading, a table cell clipped mid-sentence.
 * None of them produced a warning before. Each one must now warn.
 *
 *   npx tsx scripts/guardrails.check.ts
 */
import { pageGuardrails } from '../lib/guardrails';
import { TEMPLATES } from '../lib/templates/registry';
import type { Page, Block } from '../lib/model/types';

const tpl = (id: string) => {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error('no template ' + id);
  return t;
};

const metric = (value: string, label: string): Block => ({
  id: 'b_' + label.slice(0, 6),
  type: 'metric',
  value,
  label,
  trend: 'none',
  style: { role: 'metricLarge', align: 'left', color: 'auto' },
});

const page = (templateId: string, slots: Record<string, Block[]>): Page => ({
  id: 'pg_test',
  templateId,
  background: { kind: 'theme', overlay: 'none' },
  slots,
});

interface Case {
  name: string;
  page: Page;
  templateId: string;
  expect: string; // guardrail id prefix that must appear
}

const cases: Case[] = [
  {
    name: 'metric-four — "Q4 revenue from email" / "Audience activation begins" wrapped and lifted their numbers',
    templateId: 'metric-four',
    expect: 'mlabel-',
    page: page('metric-four', {
      main: [
        metric('$67k', 'Q4 revenue target'),
        metric('$55', 'Target blended AOV'),
        metric('$16.75k', 'Q4 revenue from email'),
        metric('Sep 1', 'Audience activation begins'),
      ],
    }),
  },
  {
    name: 'metric-three — "Average order value today" wrapped on the third column',
    templateId: 'metric-three',
    expect: 'mlabel-',
    page: page('metric-three', {
      main: [
        metric('23,200', 'Sessions, up 54%'),
        metric('334', 'Orders, up 19%'),
        metric('$43', 'Average order value today'),
      ],
    }),
  },
  {
    name: 'key-takeaways — six long phase bullets collided with the headline and the logo',
    templateId: 'key-takeaways',
    expect: 'itemlen-',
    page: page('key-takeaways', {
      main: [
        {
          id: 'b_ck',
          type: 'checklist',
          style: { role: 'subhead', align: 'left', color: 'auto' },
          items: [
            'Audience activation begins 1 September. Build the Q4 sending segments and open a weekly value-led send across a four to six week runway',
            'Refresh the Meta product feed as a gift-first catalogue set, so every October ad lands on a live gift PDP',
            'Build the gift SKUs: six sets plus Build-Your-Own, with inventory logic, a gifts collection and PDP copy',
          ],
        },
      ],
    }),
  },
  {
    name: 'data-table — the momentum table clipped "Domains aligned; free-shipping threshold lowered…"',
    templateId: 'data-table',
    expect: 'cell-',
    page: page('data-table', {
      main: [
        {
          id: 'b_tb',
          type: 'table',
          style: { role: 'body', align: 'left', color: 'auto' },
          table: {
            headers: ['Month', 'Revenue', 'Orders', 'vs April', 'What happened'],
            rows: [
              ['April 2026', '$3,082', '58', '—', 'Baseline'],
              ['May 2026', '$10,790', '205', '3.5x', 'Domains aligned; free-shipping threshold lowered + buy-6-save-15% launches'],
            ],
          },
        },
      ],
    }),
  },
];

// Pages that were fine as shipped must stay quiet, or the warnings become noise
// the team learns to ignore.
const quiet: Case[] = [
  {
    name: 'metric-four with the shortened labels that fixed the row',
    templateId: 'metric-four',
    expect: 'mlabel-',
    page: page('metric-four', {
      main: [
        metric('$67k', 'Q4 revenue target'),
        metric('$55', 'Target blended AOV'),
        metric('$16.75k', 'Q4 email revenue'),
        metric('Sep 1', 'Activation begins'),
      ],
    }),
  },
  {
    name: 'key-takeaways with five tight bullets',
    templateId: 'key-takeaways',
    expect: 'item',
    page: page('key-takeaways', {
      main: [
        {
          id: 'b_ck2',
          type: 'checklist',
          style: { role: 'subhead', align: 'left', color: 'auto' },
          items: [
            'Audience activation begins 1 September',
            'Meta product feed refreshed, gift-first',
            'Six gift sets plus Build-Your-Own in Shopify',
            'Gift photography — the long-lead item',
            'Gift guide, e-gift card, $49 threshold live',
          ],
        },
      ],
    }),
  },
];

let failed = 0;

console.log('\nMUST WARN\n' + '─'.repeat(72));
for (const c of cases) {
  const rails = pageGuardrails(c.page, tpl(c.templateId));
  const hit = rails.find((r) => r.id.startsWith(c.expect));
  if (hit) {
    console.log(`  PASS  ${c.name}`);
    console.log(`        → ${hit.text}\n`);
  } else {
    failed++;
    console.log(`  FAIL  ${c.name}`);
    console.log(`        expected a "${c.expect}" warning, got: ${rails.map((r) => r.id).join(', ') || 'none'}\n`);
  }
}

console.log('MUST STAY QUIET\n' + '─'.repeat(72));
for (const c of quiet) {
  const rails = pageGuardrails(c.page, tpl(c.templateId));
  const noisy = rails.filter((r) => r.id.startsWith(c.expect));
  if (!noisy.length) {
    console.log(`  PASS  ${c.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${c.name} — false alarm: ${noisy.map((r) => r.text).join(' | ')}`);
  }
}

console.log('\n' + (failed ? `${failed} FAILED` : 'All checks passed') + '\n');
process.exit(failed ? 1 : 0);
