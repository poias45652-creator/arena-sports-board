"""Isolated OFA trial accounts for the staging site's FIFO queue."""
import asyncio
import hashlib
import hmac
import json
import os
import re
import time
from urllib.parse import urlsplit

from aiohttp import web
from refusal import is_region_notice, signals
import delegate

PARENT = delegate.SPARE if delegate.IS_SPARE else "https://xingzhun-original-test.onrender.com"
ISSUER = "https://www.ofa1188.net"
SCREEN_KEY = os.getenv("MT_TRIAL_ALTERNATE_KEY" if delegate.IS_SPARE else "MT_TRIAL_STAGE_KEY", "")


def slot_password(name, suffix):
    password = os.getenv("OFA_MT_TRIAL_PASSWORD"+suffix)
    if password or not re.fullmatch(r"dvp[0-9]{2,12}",name):
        return password
    # Operators may store a trial password under its exact OFA account name.
    # Only the numbered OFA trial accounts can reference such a field.
    return os.getenv(name) or os.getenv(name.upper())


def credentials():
    result = {}
    seen = set()
    for n in range(1, 6):
        suffix = "" if n == 1 else "_" + str(n)
        name = os.getenv("OFA_MT_TRIAL_ACCOUNT" + suffix, "dvp0322" if n == 1 else "").strip().lower()
        password = slot_password(name,suffix)
        if name and password and name not in seen:
            seen.add(name)
            result[n] = (name, password)
    return result


def account_status():
    status = {}
    for slot in range(1, 6):
        suffix = "" if slot == 1 else "_" + str(slot)
        account = os.getenv("OFA_MT_TRIAL_ACCOUNT"+suffix, "dvp0322" if slot == 1 else "").strip()
        password = slot_password(account.lower(),suffix)
        status[slot] = ("active" if slot in credentials() else "missing account" if not account
                        else "missing password" if not password else "duplicate account")
    return status


async def report_refusal(response):
    # Retain a support reference and a category, never the launch URL, body or cookies.
    headers = await response.all_headers()
    ref = next((headers.get(k) for k in ("cf-ray","x-amz-cf-id","x-amz-request-id","x-request-id")
                if re.fullmatch(r"[A-Za-z0-9_+=/.-]{5,128}", headers.get(k,""))), None)
    try:
        body = await asyncio.wait_for(response.body(), 4)
    except Exception:
        body = None
    summary = signals(body, headers)
    if not body:
        # A cross-origin navigation may release its network body before Playwright reads it.
        try:
            frame = response.request.frame
            if frame.url == response.url:
                text = await frame.locator("body").inner_text(timeout=1200)
                if frame.url == response.url and is_region_notice(text):
                    summary["region_notice"] = True
        except Exception:
            pass
    parsed = urlsplit(response.url)
    path = parsed.path or "/"
    summary["entry_path"] = path if re.fullmatch(r"/(?:(?:game|html5|h5|desktop|mobile|live|en|tw|zh|v[12])/){0,4}(?:index\.(?:html?|php)|login/?)?",path,re.I) else "other"
    request_headers = await response.request.all_headers()
    summary["referrer"] = "trial site" if urlsplit(request_headers.get("referer","")).hostname == urlsplit(PARENT).hostname else "other" if request_headers.get("referer") else "absent"
    summary["signed_request"] = bool(re.search(r"(?:^|&)token=[^&]+",parsed.query,re.I))
    print("[MT trial] upstream refusal", urlsplit(response.url).hostname, response.status,
          json.dumps(summary, ensure_ascii=False), "support ref", ref or "none", flush=True)
    return summary


def authorize(request):
    if len(SCREEN_KEY) < 32 or not hmac.compare_digest(request.headers.get("Authorization", ""), "Bearer " + SCREEN_KEY):
        raise web.HTTPForbidden()


def observe_game(socket, ready, lost):
    url = urlsplit(socket.url)
    if url.scheme != "wss" or url.hostname != "a1.ofalive99.net" or url.path.rstrip("/") != "/game/ws":
        return
    authenticated = tables = False
    def received(frame):
        nonlocal authenticated, tables
        try:
            packet = json.loads(frame)
            action = packet.get("action")
            name = action if isinstance(action, str) else (action or {}).get("name") or (action or {}).get("path") or ""
            ok = str(packet.get("err")) == "0"
            if name.endswith("/member/logout") or (name.endswith("/authenticate") and not ok):
                lost.set()
                return
            if name.endswith("/authenticate") and ok:
                authenticated = True
            if name.endswith(("/tables", "/tablesvg")) and (ok or "err" not in packet):
                for body in (packet.get("msg"), packet.get("data"), packet):
                    data = body.get("tables") if isinstance(body, dict) else None
                    if isinstance(data, dict):
                        data = data.get("tables", data)
                    rows = list(data.values()) if isinstance(data, dict) else data
                    if isinstance(rows, list) and any(isinstance(row,dict) and re.fullmatch(r"BAV\d{2}A?(?:_LIVE)?",str(row.get("table_id",""))) for row in rows):
                        tables = True
            if authenticated and tables and not lost.is_set():
                ready.set()
        except (ValueError, TypeError, AttributeError):
            pass
    socket.on("framereceived", received)
    socket.on("close", lambda *_: lost.set())


async def grant(context, slot, allowed, device=None):
    account, password = credentials()[slot]
    if device is None:
        device = hmac.new(SCREEN_KEY.encode(), ("ofa-device:"+account).encode(), hashlib.sha256).hexdigest()[:32]
    async def post(path, payload, bearer=None):
        headers = {"Accept":"application/json"}
        if bearer:
            headers["Authorization"] = "Bearer " + bearer
        result = await context.request.post(ISSUER + path, data=payload, headers=headers, timeout=15000, max_redirects=0)
        try:
            if not result.ok:
                stage = "OFA account login" if bearer is None else "OFA MT launch grant"
                try:
                    rejection = await result.body()
                    # Exclude values supplied by the caller even if upstream reflects a credential.
                    for value in (password, account, device, bearer):
                        if value: rejection = rejection.replace(value.encode(), b"[redacted]")
                    summary = signals(rejection, result.headers)
                except Exception:
                    summary = {"body":"unavailable"}
                print("[MT trial] issuer refusal", slot, stage, result.status, json.dumps(summary,ensure_ascii=False), flush=True)
                if result.status == 422:
                    raise RuntimeError("ofa_login_422" if bearer is None else "ofa_grant_422")
                raise RuntimeError("ofa_http_"+str(result.status))
            data = await result.json()
            if str(data.get("code")) != "200":
                raise RuntimeError("ofa_refused")
            return data
        finally:
            await result.dispose()
    login = await post("/api/v1/login", {"username":account, "password":password, "device_id":device})
    auth = login.get("data") or {}
    if str(auth.get("username","")).lower() != account or not isinstance(auth.get("token"), str) or not auth["token"]:
        raise RuntimeError("ofa_login")
    response = await post("/api/v2/game/MTLI/login", {"game_return_url":ISSUER, "game_kind":"LIVE", "game_device":"Desktop", "game_money":""}, auth["token"])
    for part in (response.get("data"), response.get("raw")):
        urls = [part.get("game_url"),part.get("url")] if isinstance(part,dict) else [part]
        for url in urls:
            if isinstance(url,str):
                url = url.strip().replace(r"\/", "/").strip("\"'")
                if allowed(url):
                    return url
    raise RuntimeError("ofa_no_grant")


def install(app, Screen, sessions, same_ip, allowed):
    mutex = asyncio.Lock()

    class Trial(Screen):
        def __init__(self, ip, ticket, slot):
            super().__init__(ip, time.monotonic()+100)
            self.ticket, self.slot = ticket, slot
            self.painted = self.enabled = False
            self.ready = asyncio.Event()
            self.lost = asyncio.Event()

        async def load_entry(self, url, room):
            self.page.on("websocket", lambda socket: observe_game(socket, self.ready, self.lost))
            self.stage = "trial shell"
            for delay in (0, 2, 5):
                if delay: await asyncio.sleep(delay)
                shell = await self.page.goto(PARENT+"/mt-trial/renderer", wait_until="domcontentloaded", timeout=12000)
                if shell and shell.status == 200 and await self.page.locator('iframe[title="MT 原廠牌桌"]').count() == 1:
                    break
                status = shell.status if shell else 0
                print("[MT trial] trial shell unavailable", status, flush=True)
                if status not in (200, 502, 503, 504):
                    raise RuntimeError("trial_shell_unavailable")
            else:
                raise RuntimeError("trial_shell_unavailable")
            self.stage = "OFA authorization"
            if delegate.IS_SPARE:
                url = await delegate.request_entry(self.context,self.slot,self.ticket,self.claim,allowed)
            else:
                device = None
                if self.slot == 5 and self.ticket == globals().get("comparison_ticket"):
                    from pathlib import Path
                    if self.page.url != PARENT + "/mt-trial/renderer":
                        raise RuntimeError("unexpected_trial_origin")
                    source = Path(__file__).with_name("original-device.js").read_text()
                    device = await self.page.evaluate("async () => {" + source + "\nreturn await OriginalOFA.ofaDeviceId();}")
                    if not re.fullmatch(r"[a-f0-9]{32}",device or ""):
                        raise RuntimeError("invalid_issuer_device")
                    print("[MT comparison] original OFA device prepared",flush=True)
                url = await grant(self.context, self.slot, allowed, device)
            print("[MT trial] OFA issued grant for slot", self.slot, flush=True)
            # The original staging site's real document embeds the signed URL directly.
            # Keep the browser's normal origin, referrer, frame policy and single game socket.
            self.stage = "MT game document"
            def table_document(response):
                return (response.request.is_navigation_request()
                        and response.request.frame.parent_frame == self.page.main_frame
                        and urlsplit(response.url).hostname in {"gs1.ofalive99.net","gsa.ofalive99.net"}
                        and not 300 <= response.status < 400)
            async with self.page.expect_response(table_document, timeout=20000) as loaded:
                await self.page.locator("iframe").evaluate("(frame, url) => { frame.src = url; }", url)
            response = await loaded.value
            if response.status >= 400:
                summary = await report_refusal(response)
                if delegate.IS_SPARE and response.status == 403:
                    await delegate.sample_public_notice()
                if response.status == 403 and summary.get("region_notice"):
                    raise RuntimeError("provider_region_restricted")
                raise RuntimeError("provider_http_"+str(response.status))
            self.stage = "MT table connection"
            await asyncio.wait_for(self.ready.wait(), 28)
            if self.lost.is_set():
                raise RuntimeError("mt_disconnected")

    async def slots(request):
        authorize(request)
        return web.json_response({"slots":list(credentials())})

    async def session(request):
        authorize(request)
        body = await request.json()
        ip, ticket, slot = same_ip(body.get("ip")), body.get("ticket"), body.get("slot")
        if not ip or not isinstance(ticket,str) or not re.fullmatch("[a-f0-9]{32}",ticket) or type(slot) != int:
            raise web.HTTPBadRequest()
        async with mutex:
            trial = next((s for s in sessions.values() if isinstance(s,Trial) and s.ticket == ticket),None)
            if trial and (trial.ip != ip or trial.slot != slot):
                raise web.HTTPForbidden()
            action = body.get("action")
            if action == "painted":
                return web.json_response({"painted":bool(trial and trial.painted and not trial.closed and not trial.lost.is_set() and trial.end>time.monotonic())})
            if action == "bind":
                end = body.get("expires")
                if not trial or not trial.painted or trial.closed or trial.lost.is_set() or type(end) != int or not 0 < end/1000-time.time() <= 601:
                    raise web.HTTPConflict()
                deadline = time.monotonic() + end/1000-time.time()
                trial.end = min(trial.end,deadline) if trial.enabled else deadline
                trial.enabled = True
                return web.json_response({"ok":True})
            if action != "open" or slot not in (range(1,6) if delegate.IS_SPARE else credentials()):
                raise web.HTTPBadRequest()
            if not trial:
                for s in list(sessions.values()):
                    if isinstance(s,Trial) and s.slot == slot:
                        if s.end > time.monotonic() and not s.closed:
                            raise web.HTTPConflict(text="busy")
                        await s.close()
                trial = Trial(ip,ticket,slot)
                trial.claim = body.get("claim")
                sessions[trial.id] = trial
        async with trial.setup:
            try:
                if trial.closed or trial.end<=time.monotonic() or trial.lost.is_set():
                    raise RuntimeError("mt_disconnected")
                if not trial.page:
                    await asyncio.wait_for(trial.open(None,None),72)
                if trial.closed or trial.lost.is_set():
                    raise RuntimeError("mt_disconnected")
                return web.json_response({"id":trial.id})
            except Exception as exc:
                detail = str(exc)
                reason = detail if re.fullmatch(r"(?:provider_http_\d{3}|provider_region_restricted|ofa_(?:login|grant)_422|ofa_http_\d{3}|ofa_refused|ofa_login|ofa_no_grant|trial_shell_unavailable|mt_disconnected)", detail) else "table_not_ready"
                if reason == "table_not_ready" and trial.stage == "trial shell": reason = "trial_shell_unavailable"
                print("[MT trial]", reason, "at", trial.stage, type(exc).__name__, flush=True)
                await trial.close()
                raise web.HTTPServiceUnavailable(text=reason)

    app.router.add_get("/staging/slots",slots)
    app.router.add_post("/staging/session",session)
