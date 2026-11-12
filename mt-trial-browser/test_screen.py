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
        app.router.add_post("/v2/sessions",screen.start_session)
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
    async def test_two_accounts_at_one_ip_get_separate_screens(self):
        from unittest.mock import patch
        async def ready(screen_instance,url,room):
            screen_instance.page = SimpleNamespace()
        headers={"Authorization":"Bearer "+"k"*32}
        body={"ip":self.ip,"remaining":600,"url":"https://gs1.ofalive99.net/?token=fixture"}
        await self.screen.close()
        with patch.object(screen,"key","k"*32), patch.object(screen.Screen,"open",ready):
            self.assertEqual((await self.client.post("/v2/sessions",json=body,headers=headers)).status,400)
            async def open_for(subject,ip):
                response=await self.client.post("/v2/sessions",json={**body,"subject":subject,"account":"00000000-0000-4000-8000-"+subject[:12],"ip":ip},headers=headers)
                self.assertEqual(response.status,200)
                return (await response.json())["id"]
            first=await open_for("a"*64,self.ip)
            second=await open_for("b"*64,self.ip)
            self.assertNotEqual(first,second)
            self.assertEqual(first,await open_for("a"*64,self.ip))
            moved=await open_for("a"*64,"203.0.113.10")
            self.assertNotEqual(first,moved)
            self.assertNotIn(first,screen.sessions)
            self.assertIn(second,screen.sessions)
            for session in list(screen.sessions.values()): await session.close()

    async def test_disabled_account_loses_open_socket(self):
        from unittest.mock import patch
        path="/s/"+self.screen.id
        self.screen.subject="a"*64
        headers={"cf-connecting-ip":self.ip,"Origin":screen.origin}
        with patch.object(screen,"account_active",AsyncMock(side_effect=[True, False,False])):
            ws=await self.client.ws_connect(path+"/live",headers=headers)
            self.assertEqual(await ws.receive_bytes(),b"test pixels")
            result=await asyncio.wait_for(ws.receive(),7)
            self.assertTrue(ws.closed or result.type.name in ("CLOSE","CLOSED","CLOSING"))
            self.assertTrue(self.screen.closed)
            self.assertEqual((await self.client.get(path,headers=headers)).status,410)
            await ws.close()

    def test_upstream_allowlist(self):
        self.assertTrue(screen.allowed("https://gs1.ofalive99.net/?token=fixture"))
        for url in ["http://gs1.ofalive99.net/?token=a","https://gs1.ofalive99.net.evil.test/?token=a","https://gsa.ofalive99.net/"]:
            self.assertFalse(screen.allowed(url))
