"""Exchange a short-lived queue reservation for one MT launch on the spare renderer."""
import asyncio
import hashlib
import hmac
import os
import re
import time

from aiohttp import ClientSession, ClientTimeout, DummyCookieJar, web

from refusal import is_region_notice, Visible

SPARE = "https://arena-browser-test.onrender.com"
PRIMARY = "https://xingzhun-mt-trial-screen.onrender.com"
IS_SPARE = os.getenv("RENDER_SERVICE_ID") == "srv-dak4jsek1f9s73ed150g"
seen = {}
sampled = False


def valid_claim(claim, slot, ticket, key):
    if not isinstance(claim, dict) or not isinstance(ticket, str) or not re.fullmatch(r"[a-f0-9]{32}", ticket):
        return False
    end, signature = claim.get("end"), claim.get("sig")
    if type(end) != int or not 0 < end - time.time() <= 100 or not isinstance(signature, str) or not re.fullmatch(r"[a-f0-9]{64}",signature):
        return False
    payload = f"mt-spare-v1|{ticket}|{slot}|{end}".encode()
    return len(key) >= 32 and hmac.compare_digest(hmac.new(key.encode(), payload, hashlib.sha256).hexdigest(), signature)


def register_issuer(app, get_browser, staging, allowed):
    async def issue(request):
        data = await request.json()
        slot, ticket, claim = data.get("slot"), data.get("ticket"), data.get("claim")
        if type(slot) != int or not valid_claim(claim, slot, ticket, staging.SCREEN_KEY) or slot not in staging.credentials():
            raise web.HTTPForbidden()
        now = time.time()
        for old in [t for t, end in seen.items() if end <= now]:
            del seen[old]
        if ticket in seen:
            raise web.HTTPConflict()
        seen[ticket] = claim["end"]
        ctx = await get_browser().new_context()
        try:
            url = await staging.grant(ctx, slot, allowed)
            print("[MT trial] alternate launch granted for slot",slot,flush=True)
            return web.json_response({"url":url},headers={"Cache-Control":"no-store"})
        except RuntimeError as exc:
            reason = str(exc)
            safe = reason if re.fullmatch(r"ofa_(?:login_422|grant_422|http_\d{3}|refused|login|no_grant)",reason) else "ofa_refused"
            raise web.HTTPServiceUnavailable(text=safe)
        finally:
            await ctx.close()
    app.router.add_post("/staging/alternate-grant",issue)


async def request_entry(context, slot, ticket, claim, allowed):
    response = await context.request.post(PRIMARY+"/staging/alternate-grant",
        data={"slot":slot,"ticket":ticket,"claim":claim},timeout=35000,max_redirects=0)
    try:
        if not response.ok:
            detail = (await response.text())[:80]
            if re.fullmatch(r"ofa_(?:login_422|grant_422|http_\d{3}|refused|login|no_grant)",detail):
                raise RuntimeError(detail)
            raise RuntimeError("ofa_no_grant")
        url = (await response.json()).get("url")
        if not isinstance(url,str) or not allowed(url):
            raise RuntimeError("ofa_no_grant")
        return url
    finally:
        await response.dispose()


async def sample_public_notice():
    global sampled
    if sampled: return
    sampled = True
    try:
        async with ClientSession(cookie_jar=DummyCookieJar(),timeout=ClientTimeout(total=6)) as client:
            async with client.get("https://gs1.ofalive99.net/",allow_redirects=False) as response:
                page = Visible()
                received = 0
                async for chunk in response.content.iter_chunked(16384):
                    received += len(chunk)
                    if received > 65536:
                        break
                    page.feed(chunk.decode("utf-8","replace"))
                restricted = is_region_notice(" ".join(page.chunks))
                print("[MT spare] public root",response.status,"explicit location notice",restricted,flush=True)
    except (OSError, asyncio.TimeoutError):
        print("[MT spare] public root did not respond",flush=True)
