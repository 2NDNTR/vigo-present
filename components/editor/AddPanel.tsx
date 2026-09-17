'use client';

import type { BlockType } from '@/lib/model/types';
import { getTemplate } from '@/lib/templates/registry';
import type { Block, Page } from '@/lib/model/types';
import SheetImport from './SheetImport';
import Collapse from './Collapse';

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
  const where = slot?.label || 'the page';

  /* A list of fourteen things with seven greyed out asks you to read all
   * fourteen and work out which seven are real. Split it: what you can add
   * here is the list, and what you cannot is folded away — still there,
   * because the answer to "where is Image" is "not in this area", and a thing
   * that has vanished entirely cannot say that. */
  const fits = ITEMS.filter((it) => it.type === 'page' || !slot || slot.accepts.includes(it.type as BlockType));
  const rest = ITEMS.filter((it) => !(it.type === 'page' || !slot || slot.accepts.includes(it.type as BlockType)));

  const role = (label: string) =>
    label === 'Headline' ? 'headline' : label === 'Text' ? 'body' : label === 'Product card' ? 'product' : undefined;

  const Item = ({ it, off }: { it: (typeof ITEMS)[number]; off?: boolean }) => (
    <button
      className={'addbtn' + (off ? ' off' : '')}
      disabled={off}
      onClick={() => (it.type === 'page' ? onAddPage() : onAddBlock(it.type as BlockType, role(it.label)))}
    >
      <b>{it.label}</b>
      <i>{it.hint}</i>
    </button>
  );

  return (
    <div>
      <div className="panel-sec" style={{ paddingTop: 0 }}>
        <h4 className="panel-h">Add</h4>
        <p className="tiny" style={{ marginBottom: 12 }}>
          New content drops into <b>{where}</b>. Click another area of the page to change where it lands.
        </p>
        <div className="addlist">
          {fits.map((it, i) => (
            <Item key={i} it={it} />
          ))}
        </div>

        {rest.length ? (
          <Collapse title={'Not for ' + where} note={rest.length + ' more'}>
            <p className="tiny" style={{ margin: '0 0 10px' }}>
              These need a different area of the page. Click one on the slide and they become available.
            </p>
            <div className="addlist">
              {rest.map((it, i) => (
                <Item key={i} it={it} off />
              ))}
            </div>
          </Collapse>
        ) : null}
      </div>

      <SheetImport onInsert={onInsertBlock} canPlaceHere={template.slots.some((s) => s.accepts.includes('table'))} />
    </div>
  );
}
