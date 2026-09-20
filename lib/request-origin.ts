// Render terminates TLS before forwarding to Node. Use the configured public
// origin for CSRF checks, never a browser-supplied forwarding/identity header.
export function requestOrigin(request: Request): string {
  try {
    const url = new URL(process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || request.url);
    return ['https:', 'http:'].includes(url.protocol) ? url.origin : '';
  } catch {return '';}
}
