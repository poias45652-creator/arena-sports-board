import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

await build({
  absWorkingDir:fileURLToPath(new URL('../',import.meta.url)),
  entryPoints:['modules/hong-kong-football/ui/inner.tsx'],
  outfile:'public/hk-football/inner.js',
  bundle:true, platform:'browser', format:'esm', target:'es2022', jsx:'automatic',
  minify:true, external:['/hk-football/market.js'], define:{'process.env.NODE_ENV':'"production"'}
});
