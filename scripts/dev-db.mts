/**
 * A real Postgres engine in-process (PGlite), served on the wire protocol so
 * the app's own `pg` client connects to it unchanged. For local development
 * and tests only — never deployed.
 *
 *   npx tsx scripts/dev-db.ts [dataDir] [port]
 *   POSTGRES_URL=postgres://postgres@127.0.0.1:5433/postgres?sslmode=disable npm run dev
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const dir = process.argv[2] || '.pgdata';
const port = Number(process.argv[3] || 5433);

const db = await PGlite.create(dir === 'memory' ? undefined : dir);
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
await server.start();
console.log(`dev postgres on 127.0.0.1:${port} (${dir})`);
