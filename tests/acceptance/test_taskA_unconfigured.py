# -*- coding: utf-8 -*-
"""任务 A 验收（未配置态）：A.5-4 无 .env → 无论在线/离线都显示「云同步未配置」卡片。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import App, BASE_URL, check, set_online, summary  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')

with sync_playwright() as p:
    app = App(p, offline=True)  # 初始模拟离线
    page = app.page
    page.goto(BASE_URL + '/manage')

    # 离线态
    card = page.wait_for_selector('.action-title:has-text("云同步未配置")', timeout=8000)
    badge_cnt_off = page.locator('.status-badge').count()
    check('A.5-4 未配置+离线 → 显示「云同步未配置」卡片且无状态徽标',
          card is not None and badge_cnt_off == 0,
          f'card_title={card.inner_text()!r} badge_count={badge_cnt_off}')

    # 切在线
    set_online(page, True)
    page.wait_for_timeout(250)
    card_cnt_on = page.locator('.action-title:has-text("云同步未配置")').count()
    badge_cnt_on = page.locator('.status-badge').count()
    check('A.5-4 未配置+在线 → 仍显示「云同步未配置」卡片且无状态徽标（不随网络变）',
          card_cnt_on == 1 and badge_cnt_on == 0,
          f'card_count={card_cnt_on} badge_count={badge_cnt_on}')

    # 再切离线
    set_online(page, False)
    page.wait_for_timeout(250)
    card_cnt_off2 = page.locator('.action-title:has-text("云同步未配置")').count()
    check('A.5-4 未配置+再切离线 → 仍是「云同步未配置」卡片',
          card_cnt_off2 == 1, f'card_count={card_cnt_off2}')

    check('A.5-4c 全程无页面 JS 错误', len(app.errors) == 0, f'errors={app.errors[:6]}')
    app.close()

s = summary()
print(f"\n===== 任务A(未配置) 汇总: {s['passed']}/{s['total']} 通过 =====")
sys.exit(0 if s['failed'] == 0 else 1)
