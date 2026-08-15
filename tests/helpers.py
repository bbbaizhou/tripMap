"""共享测试工具：启动 chromium、构造 context、断言输出。"""
import os
import sys

os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from playwright.sync_api import sync_playwright  # noqa: E402

DEV_BASE = "http://localhost:5173"
PREVIEW_BASE = "http://localhost:4173"


class Result:
    def __init__(self):
        self.lines = []

    def record(self, ok: bool, name: str, detail: str):
        tag = "PASS" if ok else "FAIL"
        self.lines.append(f"[{tag}] {name} -> {detail}")
        print(f"[{tag}] {name} -> {detail}")

    def dump(self, header: str):
        print(f"\n===== {header} =====")
        for line in self.lines:
            print(line)
        n_fail = sum(1 for l in self.lines if l.startswith("[FAIL]"))
        print(f"----- {header}: {len(self.lines) - n_fail}/{len(self.lines)} passed, {n_fail} failed -----")


def launch(playwright, mobile: bool = False, **ctx_kwargs):
    browser = playwright.chromium.launch(headless=True)
    viewport = {"width": 390, "height": 844} if mobile else {"width": 1280, "height": 800}
    context = browser.new_context(viewport=viewport, **ctx_kwargs)
    page = context.new_page()
    errors = []

    def _on_pageerror(exc):
        errors.append(str(exc))

    page.on("pageerror", _on_pageerror)
    return browser, context, page, errors
