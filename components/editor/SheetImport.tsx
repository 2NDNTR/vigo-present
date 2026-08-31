'use client';

import { useRef, useState } from 'react';
import { ingestError, readSpreadsheet } from '@/lib/data/sheet';
import type { SheetTable } from '@/lib/data/sheet';
import type { Block } from '@/lib/model/types';
import { uid } from '@/lib/model/types';

/**
 * SPREADSHEET → TABLE PAGE
 * ---------------------------------------------------------------------------
 * The rep drops their export in; this shows what was found and lets them choose
 * which columns survive before anything reaches the deck.
 *
 * The confirm step is the point of the whole component. Detection has to guess
 * where a table starts and which rows are junk, and it will occasionally guess
 * wrong. Showing the result first — "header found on row 4, dropped an empty
 * column, pulled out a TOTAL" — turns a silent mistake into an obvious one
 * while it is still cheap to fix.
 *
 * Exports also run wide, and the columns a rep needs on a slide are rarely all
 * of them. Twelve columns squeezed onto a page is unreadable at any type size,
 * so the picker defaults to the first six and says so.
 */

const MAX_COLS = 6;
const MAX_ROWS = 14;

export default function SheetImport({
  onInsert,
}: {
  onInsert: (block: Block) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [table, setTable] = useState<SheetTable | null>(null);
  const [fileName, setFileName] = useState('');
  const [cols, setCols] = useState<boolean[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function ingest(file: File) {
    setBusy(true);
    setError('');
    try {
      const t = await readSpreadsheet(file);
      setTable(t);
      setFileName(file.name);
      setCols(t.headers.map((_, i) => i < MAX_COLS));
    } catch (e) {
      setTable(null);
      setError(ingestError(e));
    } finally {
      setBusy(false);
    }
  }

  function insert() {
    if (!table) return;
    const keep = table.headers.map((_, i) => i).filter((i) => cols[i]);
    if (!keep.length) return;
    const pick = (r: string[]) => keep.map((i) => r[i] ?? '');
    const block: Block = {
      id: uid('b'),
      type: 'table',
      table: {
        headers: keep.map((i) => table.headers[i]),
        rows: table.rows.slice(0, MAX_ROWS).map(pick),
        types: keep.map((i) => table.types[i]),
        total: table.totalRow ? pick(table.totalRow) : undefined,
        source: fileName,
      },
      style: { role: 'body', color: 'auto', align: 'left' },
    };
    onInsert(block);
    setTable(null);
    setFileName('');
  }

  const selectedCount = cols.filter(Boolean).length;
  const truncated = table ? Math.max(0, table.rows.length - MAX_ROWS) : 0;

  return (
    <div className="panel-sec">
      <h4 className="panel-h">From a spreadsheet</h4>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xlsm,.csv,.tsv,.txt"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await ingest(f);
          e.target.value = '';
        }}
      />

      {!table && (
        <>
          <div
            className={'dropzone' + (dragOver ? ' over' : '')}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) await ingest(f);
            }}
          >
            {busy ? (
              'Reading…'
            ) : (
              <>
                <b>Drop a spreadsheet here</b>
                <span>.xlsx or .csv — titles, blank rows and totals are handled</span>
              </>
            )}
          </div>
          <p className="tiny" style={{ marginTop: 8 }}>
            The file is read on this computer and never uploaded. Only the cells you
            keep are saved into the deck.
          </p>
        </>
      )}

      {error && (
        <div className="warn" style={{ marginTop: 10 }}>
          <span>△</span>
          <span>{error}</span>
        </div>
      )}

      {table && (
        <>
          <div className="tiny" style={{ marginBottom: 10 }}>
            <b>{fileName}</b>
            {table.meta.sheetName ? ` · ${table.meta.sheetName}` : ''} · {table.rows.length} row
            {table.rows.length === 1 ? '' : 's'}
          </div>

          {/* What detection actually did, in plain terms. If it read the file
              wrongly, this is where that becomes visible. */}
          {(table.meta.skippedTop > 0 || table.meta.droppedEmptyCols > 0 || table.totalRow) && (
            <p className="tiny" style={{ marginBottom: 10 }}>
              {[
                table.meta.skippedTop > 0 && `skipped ${table.meta.skippedTop} row${table.meta.skippedTop === 1 ? '' : 's'} above the header`,
                table.meta.droppedEmptyCols > 0 && `dropped ${table.meta.droppedEmptyCols} empty column${table.meta.droppedEmptyCols === 1 ? '' : 's'}`,
                table.totalRow && 'kept the total row',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          <div className="label" style={{ marginBottom: 6 }}>
            Columns · {selectedCount} of {table.headers.length}
          </div>
          <div className="colpick">
            {table.headers.map((h, i) => (
              <label key={i} className={'colchip' + (cols[i] ? ' on' : '')}>
                <input
                  type="checkbox"
                  checked={!!cols[i]}
                  onChange={() => setCols((c) => c.map((v, j) => (j === i ? !v : v)))}
                />
                <span>{h || `Column ${i + 1}`}</span>
                <i>{table.types[i]}</i>
              </label>
            ))}
          </div>

          {selectedCount > MAX_COLS && (
            <p className="tiny" style={{ marginTop: 8 }}>
              More than {MAX_COLS} columns will be tight on a page.
            </p>
          )}
          {truncated > 0 && (
            <p className="tiny" style={{ marginTop: 8 }}>
              The first {MAX_ROWS} rows go on the page; {truncated} more stay in your file.
            </p>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            <button className="btn primary sm" onClick={insert} disabled={!selectedCount}>
              Add table
            </button>
            <button className="btn sm" onClick={() => { setTable(null); setFileName(''); }}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
