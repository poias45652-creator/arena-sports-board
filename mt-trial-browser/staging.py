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

PARENT = "https://xingzhun-original-test.onrender.com"
ISSUER = "https://www.ofa1188.net"
SCREEN_KEY = os.getenv("MT_TRIAL_STAGE_KEY", "")


def credentials():
    result = {}
    seen = set()
    for n in range(1, 6):
        suffix = "" if n == 1 else "_" + str(n)
        name = os.getenv("OFA_MT_TRIAL_ACCOUNT" + suffix, "dvp0322" if n == 1 else "").strip().lower()
        password = os.getenv("OFA_MT_TRIAL_PASSWORD" + suffix)
        if name and password and name not in seen:
            seen.add(name)
            result[n] = (name, password)
    return result


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


async def grant(context, slot, allowed):
    account, password = credentials()[slot]
    device = hmac.new(SCREEN_KEY.encode(), ("ofa-device:"+account).encode(), hashlib.sha256).hexdigest()[:32]
    async def post(path, payload, bearer=None):
        headers = {"Accept":"application/json"}
        if bearer:
            headers["Authorization"] = "Bearer " + bearer
        result = await context.request.post(ISSUER + path, data=payload, headers=headers, timeout=15000, max_redirects=0)
        try:
            if not result.ok:
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
            if isinstance(url,str) and allowed(url):
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
            url = await grant(self.context, self.slot, allowed)
            await self.goto(url, None)
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
            if action != "open" or slot not in credentials():
                raise web.HTTPBadRequest()
            if not trial:
                for s in list(sessions.values()):
                    if isinstance(s,Trial) and s.slot == slot:
                        if s.end > time.monotonic() and not s.closed:
                            raise web.HTTPConflict(text="busy")
                        await s.close()
                trial = Trial(ip,ticket,slot)
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
                reason = detail if re.fullmatch(r"(?:provider_http_\d{3}|ofa_http_\d{3}|ofa_refused|ofa_login|ofa_no_grant|mt_disconnected)", detail) else "table_not_ready"
                print("[MT trial]", reason, flush=True)
                await trial.close()
                raise web.HTTPServiceUnavailable(text=reason)

    app.router.add_get("/staging/slots",slots)
    app.router.add_post("/staging/session",session)
