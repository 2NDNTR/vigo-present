'use client';

import Stage from '@/components/render/Stage';
import type { Page } from '@/lib/model/types';
import type { BrandId } from '@/lib/brand/themes';

export default function Thumb({ page, brand }: { page: Page | undefined; brand: BrandId }) {
  if (!page) return <div style={{ width: '100%', aspectRatio: '16/9', background: '#eee' }} />;
  return (
    <div style={{ pointerEvents: 'none', width: '100%' }}>
      <Stage page={page} brand={brand} />
    </div>
  );
}
