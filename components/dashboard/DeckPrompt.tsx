'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStore } from '@/lib/store';
import type { Presentation } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';

/**
 * DESCRIBE THE DECK
 * ---------------------------------------------------------------------------
 * The blank-deck problem, solved the way this product has to solve it: the
 * model picks a SEQUENCE from the approved layouts and drafts the words, and
 * the brand supplies everything else. What comes back is a real deck in the
 * right shapes, waiting for the facts only a salesperson has.
 *
 * Deliberately a draft, not a deliverable. It saves unpublished and opens in
 * the editor rather than going anywhere, and the planner is forbidden from
 * inventing a figure — a metric arrives with its label written and its number
 * blank, because a plausible-looking number is the one mistake nobody catches
 * before it reaches a buyer.
 */
export default function DeckPrompt({ brand }: { brand: BrandId }) {
  const router = useRouter();
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const go = async () => {
    const text = brief.trim();
    if (!text || busy) return;
    setBusy(true);
    setProblem(null);
    setNote('Choosing layouts and drafting the copy…');
    try {
      const r = await fetch('/api/compose/deck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brief: text, brand }),
      });
      const j = await r.json();
      if (!r.ok || !j.presentation) {
        setProblem(j.error || 'That could not be planned. Try describing it differently.');
        setNote(null);
        return;
      }
      const p: Presentation = j.presentation;
      const s = await getStore();
      await s.save(p);
      router.push('/e/' + p.id);
    } catch {
      setProblem('Something went wrong planning that deck.');
      setNote(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="deckprompt">
      <div className="dp-row">
        <textarea
          className="dp-input"
          rows={2}
          value={brief}
          disabled={busy}
          placeholder="Describe the deck — who it is for and what it has to prove. e.g. a Q1 line review for Publix on the rice category, arguing for two more facings."
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') go();
          }}
        />
        <button className="btn primary lg" disabled={busy || !brief.trim()} onClick={go}>
          {busy ? 'Planning…' : 'Plan the deck'}
        </button>
      </div>
      {problem ? (
        <p className="tiny dp-note">{problem}</p>
      ) : note ? (
        <p className="tiny dp-note">{note}</p>
      ) : (
        <p className="tiny dp-note">
          Picks from your approved layouts and drafts the words. Figures are left blank on purpose — it will not invent a number.
        </p>
      )}
    </div>
  );
}
