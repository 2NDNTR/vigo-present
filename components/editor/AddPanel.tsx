'use client';

import type { BlockType } from '@/lib/model/types';
import { getTemplate } from '@/lib/templates/registry';
import type { Block, Page } from '@/lib/model/types';
import SheetImport from './SheetImport';

const ITEMS: { type: BlockType | 'page'; label: string; hint: string }[] = [
  { type: 'page', label: 'Page', hint: 'Choose from the layout library' },
  { type: 'text', label: 'Headline', hint: 'Large statement' },
  { type: 'text', label: 'Text', hint: 'Body copy' },
  { type: 'card', label: 'Card', hint: 'Image, headline, sub copy' },
  { type: 'card', label: 'Product card', hint: 'Card with wholesale + MSRP' },
  { type: 'metric', label: 'Metric', hint: 'Number, label, context' },
  { type: 'image', label: 'Image', hint: 'Photography' },
  { type: 'video', label: 'Video', hint: 'Autoplaying clip' },
  { type: 'logo', label: 'Logo', hint: 'Approved brand mark' },
  { type: 'quote', label: 'Quote', hint: 'One voice' },
  { type: 'checklist', label: 'Checkmarks', hint: 'Key points' },
  { type: 'bullets', label: 'Bullet list', hint: 'Simple list' },
  { type: 'divider', label: 'Divider', hint: 'Accent rule' },
  { type: 'cta', label: 'Call to action', hint: 'Outlined button' },
];

export default function AddPanel({
  page,
  activeSlot,
  onAddPage,
  onAddBlock,
  onInsertBlock,
}: {
  page: Page;
  activeSlot: string | null;
  onAddPage: () => void;
  onAddBlock: (type: BlockType, role?: string) => void;
  onInsertBlock: (block: Block) => void;
}) {
  const template = getTemplate(page.templateId);
  const slot = template.slots.find((s) => s.key === activeSlot) || template.slots[0];

  return (
    <div>
      <div className="panel-sec" style={{ paddingTop: 0 }}>
        <h4 className="panel-h">Add</h4>
        <p className="tiny" style={{ marginBottom: 12 }}>
          New content drops into <b>{slot?.label || 'the page'}</b>. Click another area of the page to
          change where it lands.
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {ITEMS.map((it, i) => {
            const disabled =
              it.type !== 'page' && slot && !slot.accepts.includes(it.type as BlockType);
            return (
              <button
                key={i}
                className="btn"
                style={{
                  height: 'auto',
                  padding: '10px 12px',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  opacity: disabled ? 0.35 : 1,
                }}
                disabled={disabled}
                onClick={() =>
                  it.type === 'page'
                    ? onAddPage()
                    : onAddBlock(
                        it.type as BlockType,
                        it.label === 'Headline'
                          ? 'headline'
                          : it.label === 'Text'
                          ? 'body'
                          : it.label === 'Product card'
                          ? 'product'
                          : undefined
                      )
                }
              >
                <span>
                  <span style={{ display: 'block', fontWeight: 550 }}>{it.label}</span>
                  <span className="tiny">{it.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <SheetImport onInsert={onInsertBlock} canPlaceHere={template.slots.some((s) => s.accepts.includes('table'))} />
    </div>
  );
}
