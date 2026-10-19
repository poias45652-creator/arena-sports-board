import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

// Pre-render the complete game document at build time. All code and assets
// are served by this website, with browser saves stored on this origin.
export const dynamic = 'force-static';
export const runtime = 'nodejs';

export async function GET() {
  const html = await readFile(join(process.cwd(), 'public/game-life/index.html'), 'utf8');
  return new Response(html, {
    headers: {'Content-Type': 'text/html; charset=utf-8'},
  });
}
