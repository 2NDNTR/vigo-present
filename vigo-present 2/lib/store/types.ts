import type { Presentation, PresentationVersion } from '@/lib/model/types';

export interface Store {
  readonly kind: 'local' | 'api';
  list(): Promise<Presentation[]>;
  get(id: string): Promise<Presentation | null>;
  getBySlug(slug: string): Promise<Presentation | null>;
  save(p: Presentation): Promise<void>;
  remove(id: string): Promise<void>;
  versions(id: string): Promise<PresentationVersion[]>;
  snapshot(p: Presentation, label: string): Promise<void>;
  restore(versionId: string): Promise<Presentation | null>;
}
