import asyncio
import os
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import json
import staging


class SessionSignalTests(unittest.TestCase):
    def test_only_real_table_after_successful_auth_counts(self):
        handlers = {}
        sock = SimpleNamespace(url="wss://a1.ofalive99.net/game/ws", on=handlers.__setitem__)
        ready, lost = asyncio.Event(), asyncio.Event()
        staging.observe_game(sock, ready, lost)
        emit=lambda p: handlers["framereceived"](json.dumps(p))
        emit({"action":"/api/v1/authenticate","err":0})
        self.assertFalse(ready.is_set())
        emit({"action":"/api/v1/room/tables","err":0,"msg":{"tables":[]}})
        self.assertFalse(ready.is_set())
        emit({"action":"/api/v1/room/tables","err":0,"msg":{"tables":[{"table_id":"BAV01"}]}})
        self.assertTrue(ready.is_set())
        emit({"action":"/api/v1/member/logout","msg":{"code":3}})
        self.assertTrue(lost.is_set())

    def test_account_pool_has_only_distinct_configured_accounts(self):
        values={"OFA_MT_TRIAL_PASSWORD":"fixture",
                "OFA_MT_TRIAL_ACCOUNT_2":"DVP0322","OFA_MT_TRIAL_PASSWORD_2":"fixture",
                "OFA_MT_TRIAL_ACCOUNT_3":"third","OFA_MT_TRIAL_PASSWORD_3":"fixture",
                "OFA_MT_TRIAL_ACCOUNT_4":"missing"}
        with patch.dict(os.environ,values,clear=True):
            self.assertEqual(list(staging.credentials()),[1,3])

    def test_account_named_fields_are_isolated_and_numbered_fields_win(self):
        values={"OFA_MT_TRIAL_ACCOUNT_2":"dvp777","dvp777":"fixture alias",
                "OFA_MT_TRIAL_ACCOUNT_3":"dvp776","DVP776":"fixture alias",
                "OFA_MT_TRIAL_PASSWORD_3":"fixture explicit",
                "OFA_MT_TRIAL_ACCOUNT_4":"MT_SCREEN_KEY","MT_SCREEN_KEY":"fixture service key"}
        with patch.dict(os.environ,values,clear=True):
            self.assertEqual(staging.credentials(),{2:("dvp777","fixture alias"),3:("dvp776","fixture explicit")})
