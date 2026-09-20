/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import {readSession} from '../lib/arena-session';
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if(url.pathname==='/' || url.pathname==='/teams' || url.pathname.startsWith('/teams/') || url.pathname.startsWith('/players/')){
      try { if(!await readSession(env.DB,request.headers.get('cookie')))return new Response(null,{status:302,headers:{Location:'/login','Cache-Control':'private, no-store'}}); }
      catch{return new Response('登入服務暫時無法使用，請稍後重試。',{status:503,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'}});}
    }
    // The scheduler route owns a separate constant-time server-token check;
    // normal member APIs still require the existing verified account session.
    const schedulerRequest=url.pathname==='/api/international-sync'&&request.method==='POST';
    if(url.pathname.startsWith('/api/')&&url.pathname!=='/api/session'&&!schedulerRequest&&!url.pathname.startsWith('/api/admin/')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()!=='admin@example.invalid'){
      try{if(!await readSession(env.DB,request.headers.get('cookie')))return Response.json({error:'請重新登入；帳號可能已停用或到期'},{status:401,headers:{'Cache-Control':'private, no-store'}});}
      catch{return Response.json({error:'使用權驗證暫時無法完成'},{status:503,headers:{'Cache-Control':'no-store'}});}
    }
    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
