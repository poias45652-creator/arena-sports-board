import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export async function footballShell() {
  const html = await readFile(join(process.cwd(),'modules/hong-kong-football/shell.html'),'utf8');
  return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
