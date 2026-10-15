import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

// Keep existing bookmark icon URLs working after the brand change.
export async function GET() {
  const image = await readFile(join(process.cwd(), 'public/brand/xingzhun-icon-180-v1.png'));
  return new Response(new Uint8Array(image), {
    headers: {'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=0, must-revalidate'},
  });
}
