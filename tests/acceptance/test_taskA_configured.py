# -*- coding: utf-8 -*-
"""任务 A 验收（已配置态）：A.5-1 / A.5-2 / A.5-3 / A.5-5。运行前提：.env 存在（假凭据），dev server 已随 .env 重启。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import (  # noqa: E402
    App, BASE_URL, check, read_queue, set_online, summary,
)
from playwright.sync_api import sync_playwright  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')

with sync_playwright() as p:
    app = App(p, offline=True)  # init script：navigator.onLine getter → false（模拟 DevTools 离线）
    page = app.page

    # ---------- A.5-1 已配置 + 离线 → 刷新页面徽标直接显示「离线」，无需点击 ----------
    page.goto(BASE_URL + '/manage')
    badge = page.wait_for_selector('.status-badge', timeout=8000)
    t1 = badge.inner_text()
    c1 = badge.get_attribute('class') or ''
    check('A.5-1 已配置+DevTools离线+刷新 → 徽标直接「离线」(灰底)',
          t1 == '离线' and 'offline' in c1, f'badge_text={t1!r} badge_class={c1!r}')

    # ---------- A.5-2 恢复在线 → 立即回「已就绪」，不点同步、不粘滞 ----------
    set_online(page, True)
    page.wait_for_timeout(200)
    t2 = page.locator('.status-badge').inner_text()
    c2 = page.locator('.status-badge').get_attribute('class') or ''
    check('A.5-2 恢复在线 → 徽标立即「已就绪」且不粘滞「离线」',
          t2 == '已就绪' and 'idle' in c2 and 'offline' not in c2,
          f'badge_text={t2!r} badge_class={c2!r}')

    # ---------- A.5-3 在线切离线 → 立即变「离线」 ----------
    set_online(page, False)
    page.wait_for_timeout(200)
    t3 = page.locator('.status-badge').inner_text()
    c3 = page.locator('.status-badge').get_attribute('class') or ''
    check('A.5-3 在线切离线 → 徽标立即「离线」',
          t3 == '离线' and 'offline' in c3, f'badge_text={t3!r} badge_class={c3!r}')

    # ---------- A.5-5 点「立即同步」行为不变（syncing 短暂出现后回落） ----------
    set_online(page, True)
    page.wait_for_timeout(150)
    # 先造 1 条队列（经 UI 添加城市触发入队，确保 syncNow 走 syncing 分支）
    page.click('.tab:has-text("添加城市足迹")')
    page.fill('input[placeholder="如：成都"]', '测试城市甲')
    page.fill('input[placeholder="如：四川省"]', '四川省')
    page.fill('input[type="date"]', '2024-01-01')
    page.fill('input[placeholder="如：30.5728"]', '30.5')
    page.fill('input[placeholder="如：104.0668"]', '104.0')
    page.click('.submit-btn:has-text("添加城市足迹")')
    page.wait_for_selector('.form-success:has-text("已添加城市")', timeout=5000)
    q_before = read_queue(page)
    check('A.5-5 前置：UI 添加城市后队列恰 1 条（供 syncing 分支）',
          isinstance(q_before, list) and len(q_before) == 1,
          f'queue_len={len(q_before) if isinstance(q_before, list) else q_before}')

    page.click('.tab:has-text("备份与恢复")')
    page.wait_for_selector('.sync-btn', timeout=5000)
    # 观察按钮文本瞬态（MutationObserver 记录每次文本变化）
    page.evaluate("""() => {
        window.__btnLog = [];
        const btn = document.querySelector('.sync-btn');
        if (btn) {
            new MutationObserver(() => {
                const t = btn.textContent && btn.textContent.trim();
                if (t && window.__btnLog[window.__btnLog.length - 1] !== t) window.__btnLog.push(t);
            }).observe(btn, { childList: true, subtree: true, characterData: true });
        }
    }""")
    page.click('.sync-btn')
    page.wait_for_timeout(700)
    btn_text = page.locator('.sync-btn').inner_text().strip()
    badge_after = page.locator('.status-badge').inner_text()
    btn_log = page.evaluate("() => window.__btnLog || []")
    q_after = read_queue(page)
    check('A.5-5 点击「立即同步」→ 按钮回落「立即同步」、徽标回「已就绪」、队列保留(dry-run 不清队)',
          btn_text == '立即同步' and badge_after == '已就绪'
          and isinstance(q_after, list) and len(q_after) == 1,
          f'btn={btn_text!r} badge={badge_after!r} queue_len={len(q_after) if isinstance(q_after, list) else q_after} btn_log={btn_log!r}')
    check('A.5-5 附加观察：按钮是否短暂出现过「同步中…」',
          '同步中…' in btn_log, f'btn_log={btn_log!r}（瞬态过短时可能观察不到，非判败）')

    # 离线时再点「立即同步」：按钮仍可点、徽标仍「离线」（A.4 语义）
    set_online(page, False)
    page.wait_for_timeout(150)
    disabled_offline = page.locator('.sync-btn').is_disabled()
    page.click('.sync-btn')
    page.wait_for_timeout(300)
    badge_off = page.locator('.status-badge').inner_text()
    check('A.5-5b 离线时点「立即同步」→ 按钮可点、徽标保持「离线」',
          disabled_offline is False and badge_off == '离线',
          f'disabled={disabled_offline} badge={badge_off!r}')

    check('A.5-5c 全程无页面 JS 错误', len(app.errors) == 0, f'errors={app.errors[:6]}')
    app.close()

s = summary()
print(f"\n===== 任务A(已配置) 汇总: {s['passed']}/{s['total']} 通过 =====")
sys.exit(0 if s['failed'] == 0 else 1)
