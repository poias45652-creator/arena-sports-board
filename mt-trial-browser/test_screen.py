import asyncio
import time
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer
import screen

class GuestScreenTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.ip = "192.0.2.48"
        self.screen = screen.Screen(self.ip,time.monotonic()+15)
        self.screen.page = SimpleNamespace(mouse=SimpleNamespace(click=AsyncMock()))
        self.screen.jpeg = b"test pixels"
        screen.sessions[self.screen.id] = self.screen
        screen.origin = "https://screen.example"
        app=web.Application()
        app.router.add_get("/s/{id}",screen.view)
        app.router.add_get("/s/{id}/live",screen.live)
        app.router.add_post("/sessions",screen.start_session)
        self.client=TestClient(TestServer(app))
        await self.client.start_server()
    async def asyncTearDown(self):
        await self.client.close()
        await self.screen.close()
    async def test_only_bound_ip_can_open_or_control(self):
        path="/s/"+self.screen.id
        self.assertEqual((await self.client.get(path,headers={"cf-connecting-ip":"192.0.2.9"})).status,403)
        self.assertEqual((await self.client.post("/sessions",json={})).status,403)
        headers={"cf-connecting-ip":self.ip,"Origin":screen.origin}
        response=await self.client.get(path,headers=headers)
        self.assertEqual(response.status,200)
        self.assertNotIn("ofalive",await response.text())
        ws=await self.client.ws_connect(path+"/live",headers=headers)
        self.assertEqual(await ws.receive_bytes(),b"test pixels")
        await ws.send_json({"type":"click","x":.5,"y":.25})
        for _ in range(20):
            if self.screen.page.mouse.click.called:break
            await asyncio.sleep(.01)
        self.screen.page.mouse.click.assert_awaited_once()
        self.screen.end=time.monotonic()-.01
        await ws.send_json({"type":"click","x":.1,"y":.1})
        await asyncio.wait_for(ws.receive(),2)
        self.screen.page.mouse.click.assert_awaited_once()
        self.assertEqual((await self.client.get(path,headers=headers)).status,410)
        await ws.close()
    def test_upstream_allowlist(self):
        self.assertTrue(screen.allowed("https://gs1.ofalive99.net/?token=fixture"))
        for url in ["http://gs1.ofalive99.net/?token=a","https://gs1.ofalive99.net.evil.test/?token=a","https://gsa.ofalive99.net/"]:
            self.assertFalse(screen.allowed(url))
