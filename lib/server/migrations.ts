import 'server-only';

/**
 * VERSIONED MIGRATIONS
 * ---------------------------------------------------------------------------
 * V1 created its tables with `create table if not exists` on the first query of
 * every cold start. That is fine for one app and one database, and dangerous
 * for two: anything pointed at V1's database would run V1's DDL as a side
 * effect of reading it.
 *
 * V2 records what it has applied in `schema_migrations` and applies each step
 * exactly once, in order, inside a transaction, under an advisory lock so two
 * cold starts cannot race. Steps are append-only: never edit one that has
 * shipped, add the next number instead.
 *
 * 0001 is V1's schema verbatim (every statement idempotent), so a restored V1
 * dump and an empty database both arrive at the same place.
 */

export interface Migration {
  id: string;
  sql?: string;
  /** for steps SQL cannot express (hashing legacy passwords, say) */
  run?: (query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '0001_v1_baseline',
    sql: `
      create table if not exists users (
        id            text primary key,
        email         text unique not null,
        name          text not null default '',
        password_hash text,
        role          text not null default 'editor',
        created_at    bigint not null,
        last_seen     bigint
      );

      create table if not exists presentations (
        id          text primary key,
        org_id      text not null default 'vigo-importing',
        title       text not null,
        brand       text not null,
        status      text not null default 'draft',
        slug        text unique,
        locked      boolean not null default false,
        doc         jsonb not null,
        version     integer not null default 1,
        created_by  text,
        updated_by  text,
        created_at  bigint not null,
        updated_at  bigint not null
      );
      create index if not exists presentations_org_idx
        on presentations(org_id, updated_at desc);

      create table if not exists assets (
        id          text primary key,
        brand       text not null,
        category    text not null,
        name        text not null,
        file_name   text not null,
        url         text not null,
        kind        text not null default 'image',
        width       integer,
        height      integer,
        size        bigint,
        uploaded_by text,
        created_at  bigint not null
      );
      create index if not exists assets_brand_idx on assets(brand, category);

      create table if not exists presence (
        presentation_id text not null,
        user_id         text not null,
        page_id         text,
        seen_at         bigint not null,
        primary key (presentation_id, user_id)
      );
      create index if not exists presence_deck_idx on presence(presentation_id, seen_at);

      create table if not exists notes (
        id              text primary key,
        presentation_id text not null,
        page_id         text,
        author_id       text not null,
        body            text not null,
        mentions        jsonb not null default '[]'::jsonb,
        resolved        boolean not null default false,
        created_at      bigint not null
      );
      create index if not exists notes_deck_idx on notes(presentation_id, created_at);
    `,
  },

  {
    id: '0002_brands_and_roles',
    sql: `
      create table brands (
        id           text primary key,
        name         text not null,
        short_name   text not null default '',
        description  text not null default '',
        -- what the AI is told about how this brand speaks
        voice        text not null default '',
        disclaimers  text not null default '',
        guidelines   text not null default '',
        -- default slide count, audience, tone for new decks
        defaults     jsonb not null default '{}'::jsonb,
        -- admin edits to colours, faces and logo; null = the code theme as shipped
        theme_override jsonb,
        archived     boolean not null default false,
        created_at   bigint not null,
        updated_at   bigint not null
      );

      insert into brands (id, name, short_name, description, created_at, updated_at) values
        ('corporate', 'Vigo Importing Co.', 'Corporate', 'The parent company: capabilities, heritage and manufacturing.', 0, 0),
        ('vigo',      'Vigo Foods',         'Vigo',      'Rice, pasta, breadcrumbs and Mediterranean pantry staples.',    0, 0),
        ('alessi',    'Alessi Foods',       'Alessi',    'Premium Italian specialty foods.',                               0, 0)
      on conflict (id) do nothing;

      alter table users add column if not exists platform_admin boolean not null default false;
      update users set platform_admin = true where role = 'admin';

      create table memberships (
        user_id    text not null references users(id) on delete cascade,
        brand_id   text not null references brands(id) on delete cascade,
        role       text not null check (role in ('brand_admin', 'editor', 'viewer')),
        created_at bigint not null,
        primary key (user_id, brand_id)
      );

      -- Nobody loses access on the way in: in V1 every member could edit every
      -- deck, so every existing member starts as an editor of every brand.
      -- Narrowing that is an admin decision made after cutover, not a migration.
      insert into memberships (user_id, brand_id, role, created_at)
        select u.id, b.id, 'editor', (extract(epoch from now()) * 1000)::bigint
        from users u cross join brands b
        where not u.platform_admin
      on conflict do nothing;
    `,
  },

  {
    id: '0003_presentations_versions_sharing',
    sql: `
      alter table presentations add column if not exists brand_id text references brands(id);
      update presentations set brand_id = brand
        where brand_id is null and brand in (select id from brands);
      alter table presentations add column if not exists archived_at bigint;
      create index if not exists presentations_brand_idx on presentations(brand_id, updated_at desc);

      create table presentation_versions (
        id              text primary key,
        presentation_id text not null references presentations(id) on delete cascade,
        n               integer not null,
        label           text not null default '',
        -- generate | ai-accept | publish | restore | checkpoint
        reason          text not null default 'checkpoint',
        snapshot        jsonb not null,
        author_id       text,
        created_at      bigint not null,
        unique (presentation_id, n)
      );

      -- Every existing deck gets a version 1, so "restore" has something to
      -- restore to from the first day.
      insert into presentation_versions (id, presentation_id, n, label, reason, snapshot, author_id, created_at)
        select 'ver_' || p.id || '_1', p.id, 1, 'Carried over from V1', 'checkpoint', p.doc, p.updated_by, p.updated_at
        from presentations p
      on conflict do nothing;

      create table share_links (
        id              text primary key,
        presentation_id text not null references presentations(id) on delete cascade,
        slug            text not null unique,
        -- public: anyone with the link · password: link + password · private: signed-in members only
        access          text not null default 'public' check (access in ('public', 'password', 'private')),
        password_hash   text,
        layout          text not null default 'vertical' check (layout in ('vertical', 'horizontal')),
        revoked_at      bigint,
        created_by      text,
        created_at      bigint not null
      );
      create index share_links_deck_idx on share_links(presentation_id);

      -- Every V1 slug keeps working: it becomes this deck's first link.
      -- V1 "slide" mode was the sideways one, so it maps to horizontal.
      insert into share_links (id, presentation_id, slug, access, layout, created_by, created_at)
        select 'shl_' || p.id, p.id, p.slug,
               case p.doc->'share'->>'access'
                 when 'password' then 'password'
                 when 'internal' then 'private'
                 else 'public' end,
               case when p.doc->'share'->>'mode' = 'slide' then 'horizontal' else 'vertical' end,
               p.created_by, p.created_at
        from presentations p
        where p.slug is not null
      on conflict do nothing;
    `,
    // V1 kept deck passwords in plain text inside the doc. Hash them now so the
    // plain text can be dropped from every copy V2 writes.
    run: async (query) => {
      const { hashPassword } = await import('./passwords');
      const r = await query(
        `select s.id, p.doc->'share'->>'password' as pw
         from share_links s join presentations p on p.id = s.presentation_id
         where s.access = 'password' and s.password_hash is null`
      );
      for (const row of r.rows) {
        const pw = String(row.pw || '');
        if (pw) await query('update share_links set password_hash = $1 where id = $2', [hashPassword(pw), row.id]);
        // a password link with no password would be an open link wearing a lock
        else await query(`update share_links set access = 'private' where id = $1`, [row.id]);
      }
      await query(`update presentations set doc = doc #- '{share,password}' where doc->'share' ? 'password'`);
    },
  },

  {
    id: '0004_assets_jobs_audit',
    sql: `
      alter table assets add column if not exists tags text[] not null default '{}';
      alter table assets add column if not exists description text not null default '';
      alter table assets add column if not exists private boolean not null default false;
      alter table assets add column if not exists aspect real;
      update assets set aspect = width::real / height where aspect is null and width > 0 and height > 0;

      create table asset_usages (
        asset_id        text not null,
        presentation_id text not null references presentations(id) on delete cascade,
        page_id         text not null,
        primary key (asset_id, presentation_id, page_id)
      );
      create index asset_usages_asset_idx on asset_usages(asset_id);

      create table generation_jobs (
        id              text primary key,
        brand_id        text not null references brands(id),
        user_id         text not null,
        kind            text not null default 'deck',
        -- queued | outlining | outlined | composing | validating | done | failed | cancelled
        stage           text not null default 'queued',
        brief           jsonb not null,
        outline         jsonb,
        presentation_id text,
        error           text,
        model           text,
        input_tokens    integer not null default 0,
        output_tokens   integer not null default 0,
        created_at      bigint not null,
        updated_at      bigint not null
      );
      create index generation_jobs_user_idx on generation_jobs(user_id, created_at desc);

      create table audit_events (
        id         bigserial primary key,
        actor_id   text,
        action     text not null,
        target     text,
        detail     jsonb not null default '{}'::jsonb,
        at         bigint not null
      );
      create index audit_events_at_idx on audit_events(at desc);
    `,
  },
];
