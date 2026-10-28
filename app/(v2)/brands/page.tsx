'use client';

import BrandTiles from '@/components/v2/BrandTiles';
import { useApp } from '@/components/v2/Shell';

export default function Brands() {
  const { brands } = useApp();
  return (
    <>
      <div className="v2-head">
        <div>
          <h1 className="t-title">Brands</h1>
          <p className="t-small">Each brand keeps its own identity, guidance, photography and presentations.</p>
        </div>
      </div>
      <BrandTiles brands={brands} />
    </>
  );
}
