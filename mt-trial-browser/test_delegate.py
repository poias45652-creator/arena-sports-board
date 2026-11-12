import hashlib
import hmac
import time
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

import delegate


class SpareGrantTest(unittest.IsolatedAsyncioTestCase):
    async def test_only_the_reserved_slot_can_exchange_a_ticket_once(self):
        key = "x"*32
        ticket = "ad"*16
        slot, end = 2, int(time.time())+90
        sig = hmac.new(key.encode(), f"mt-spare-v1|{ticket}|{slot}|{end}".encode(), hashlib.sha256).hexdigest()
        claim = {"end":end,"sig":sig}
        context = SimpleNamespace(close=AsyncMock())
        browser = SimpleNamespace(new_context=AsyncMock(return_value=context))
        stage = SimpleNamespace(SCREEN_KEY=key,credentials=lambda:{2:True,3:True},grant=AsyncMock(return_value="https://example.test/fixture"))
        app = web.Application()
        delegate.register_issuer(app,lambda:browser,stage,None)
        async with TestClient(TestServer(app)) as client:
            async def send(n):
                return await client.post("/staging/alternate-grant",json={"slot":n,"ticket":ticket,"claim":claim})
            self.assertEqual((await send(3)).status,403)
            response = await send(2)
            self.assertEqual((await response.json())["url"],"https://example.test/fixture")
            self.assertEqual(response.headers["Cache-Control"],"no-store")
            self.assertEqual((await send(2)).status,409)
            stage.grant.assert_awaited_once()
            context.close.assert_awaited_once()
        delegate.seen.pop(ticket,None)
