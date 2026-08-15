# -*- coding: utf-8 -*-
"""通用测试辅助：浏览器启动、seed 构造、队列/数据读取、结果记录。"""
import json
import sys
from pathlib import Path

BASE = Path(r'E:\vscodeProject\tripMap')
BASE_URL = 'http://localhost:5173'
QUEUE_KEY = 'travel_footprint_sync_queue'
DATA_KEY = 'travel_footprint_data'

RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, cond: bool, evidence: str = '') -> bool:
    RESULTS.append((name, bool(cond), evidence))
    print(f"{'[PASS]' if cond else '[FAIL]'} {name} | {evidence}")
    return bool(cond)


def summary() -> dict:
    total = len(RESULTS)
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    return {'total': total, 'passed': passed, 'failed': total - passed}


def build_seed_state() -> dict:
    """种子状态：三个数组齐全 + 18 个基础景点（与 /scenic 的 fetch 内容一致，避免噪声入队）。"""
    spots = json.loads((BASE / 'public' / 'data' / 'scenic-spots-base.json').read_text(encoding='utf-8'))
    return {
        'schemaVersion': 2,
        'version': '2.0',
        'visitedCities': [],
        'scenicSpots': spots,
        'memories': [],
    }


def seed_data_json() -> str:
    return json.dumps(build_seed_state(), ensure_ascii=False)


def v1_state_json() -> str:
    """旧版 v1 数据（无 schemaVersion、city 缺 country）→ 触发迁移写回。"""
    return json.dumps({
        'visitedCities': [{
            'cityId': 'x-v1-city',
            'cityName': '迁移测试城',
            'province': '四川省',
            'firstVisitDate': '2024-01-01',
            'visitCount': 1,
            'totalDays': 1,
            'scenicSpotIds': [],
            'memoryIds': [],
            'lat': 30.5,
            'lng': 104.0,
        }],
        'scenicSpots': [],
        'memories': [],
    }, ensure_ascii=False)


OFFLINE_INIT_JS = (
    "Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });"
)


class App:
    """封装 browser/context/page + 错误收集。"""

    def __init__(self, p, offline: bool = False):
        self.browser = p.chromium.launch(headless=True)
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        self.errors: list[str] = []

        def on_console(msg):
            if msg.type == 'error':
                self.errors.append(f'console.error: {msg.text}')

        def on_pageerror(err):
            self.errors.append(f'pageerror: {err}')

        self.page.on('console', on_console)
        self.page.on('pageerror', on_pageerror)
        if offline:
            self.page.add_init_script(OFFLINE_INIT_JS)

    def close(self):
        try:
            self.browser.close()
        except Exception:
            pass


def set_online(page, value: bool):
    """重定义 navigator.onLine getter 并派发对应事件（模拟 DevTools 在线/离线切换）。"""
    page.evaluate("""(v) => {
        Object.defineProperty(navigator, 'onLine', { get: () => v, configurable: true });
        window.dispatchEvent(new Event(v ? 'online' : 'offline'));
    }""", value)


def read_queue(page) -> list | dict:
    return page.evaluate("""() => {
        const raw = localStorage.getItem('travel_footprint_sync_queue');
        if (!raw) return [];
        try { return JSON.parse(raw); } catch (e) { return { __corrupt_raw__: raw }; }
    }""")


def read_data(page) -> dict | None:
    return page.evaluate("""() => {
        const raw = localStorage.getItem('travel_footprint_data');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return { __corrupt_raw__: raw }; }
    }""")


def reset_storage(page, mode: str = 'seed', queue: str | None = None, data: str | None = None):
    """把 localStorage 置为测试基线后 reload，应用随之重新 init。
    mode: 'seed'=写入种子数据 | 'fresh'=删除数据 key | 'corrupt'=写入损坏数据。
    先导航到应用源，确保 localStorage 可访问（about:blank 下会被拒绝）。
    """
    page.goto(BASE_URL + '/')
    if mode == 'seed' and data is None:
        data = seed_data_json()
    page.evaluate("""(args) => {
        if (args.queue == null) localStorage.removeItem('travel_footprint_sync_queue');
        else localStorage.setItem('travel_footprint_sync_queue', args.queue);
        if (args.mode === 'seed' || args.mode === 'corrupt') {
            localStorage.setItem('travel_footprint_data', args.data);
        } else if (args.mode === 'fresh') {
            localStorage.removeItem('travel_footprint_data');
        }
    }""", {'mode': mode, 'queue': queue, 'data': data})
    page.reload()
    page.wait_for_selector('.app-shell', timeout=8000)


PINIA_SNIPPET = r"""
function getPinia() {
  const el = document.querySelector('#app');
  const app = el && el.__vue_app__;
  if (!app) return null;
  const prov = (app._context && app._context.provides) || {};
  const vals = [];
  for (const k of Object.getOwnPropertySymbols(prov)) vals.push(prov[k]);
  for (const k of Object.keys(prov)) vals.push(prov[k]);
  for (const v of vals) {
    if (v && typeof v === 'object' && v._s instanceof Map) return v;
  }
  return null;
}
"""


def call_store(page, store_id: str, js_body: str):
    """通过应用内 pinia 实例调用 store 方法（用于无 UI 入口的 updateCity/removeCity/removeSpot）。"""
    script = f"""
(() => {{
{PINIA_SNIPPET}
const p = getPinia();
if (!p) return 'NO_PINIA';
const s = p._s.get('{store_id}');
if (!s) return 'NO_STORE';
{js_body}
return 'OK';
}})()
"""
    return page.evaluate(script)
