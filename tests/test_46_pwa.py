"""任务 4.6 PWA 离线化 —— 规格 §2.6 共 5 条验收（需 preview 服务器 4173）。"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Result, launch, PREVIEW_BASE  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

DIST = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")


def wait_map(page):
    page.wait_for_selector(".geo-source-bar:visible, .fallback-notice:visible", timeout=20000)
    page.wait_for_timeout(800)


def main():
    r = Result()

    # ---- 验收 1：dist 产物与 index.html 注入 ----
    sw_ok = os.path.exists(os.path.join(DIST, "sw.js"))
    manifest_ok = os.path.exists(os.path.join(DIST, "manifest.webmanifest"))
    workbox_ok = any(f.startswith("workbox-") and f.endswith(".js") for f in os.listdir(DIST))
    with open(os.path.join(DIST, "index.html"), encoding="utf-8") as f:
        html = f.read()
    link_ok = 'rel="manifest"' in html
    theme_ok = 'name="theme-color" content="#2e7d32"' in html
    r.record(
        sw_ok and manifest_ok and workbox_ok and link_ok and theme_ok,
        "4.6-1 dist 含 sw.js/manifest.webmanifest/workbox-*.js 且 index.html 注入 manifest link 与 theme-color",
        f"sw.js={sw_ok}, manifest.webmanifest={manifest_ok}, workbox={workbox_ok}, "
        f"manifest link={link_ok}, theme-color={theme_ok}",
    )

    with sync_playwright() as pw:
        # ---- 验收 2：preview 下 manifest 名称/主题色正确、SW 激活 ----
        browser, context, page, errors = launch(pw)
        page.goto(PREVIEW_BASE, wait_until="domcontentloaded")
        page.wait_for_selector(".app-shell", timeout=20000)
        # 等待 SW ready（注册在 load 事件后）
        page.wait_for_function(
            "navigator.serviceWorker && navigator.serviceWorker.ready.then(r => !!r.active)",
            timeout=20000,
        )
        sw_state = page.evaluate(
            "navigator.serviceWorker.getRegistration().then(r => ({scope: r.scope, state: r.active.state}))"
        )
        manifest = page.evaluate("fetch('./manifest.webmanifest').then(r => r.json())")
        name_ok = manifest.get("name") == "旅行足迹" and manifest.get("short_name") == "旅行足迹"
        theme_ok2 = manifest.get("theme_color") == "#2e7d32"
        display_ok = manifest.get("display") == "standalone"
        sw_active = sw_state.get("state") == "activated"
        r.record(
            name_ok and theme_ok2 and display_ok and sw_active,
            "4.6-2 preview manifest 名称/主题色/SW 激活",
            f"manifest.name={manifest.get('name')!r}, short_name={manifest.get('short_name')!r}, "
            f"theme_color={manifest.get('theme_color')!r}, display={manifest.get('display')!r}, "
            f"SW scope={sw_state.get('scope')}, state={sw_state.get('state')}",
        )
        browser.close()

        # ---- 验收 3：Offline 下应用壳 + 本地 GeoJSON 可用；瓦片缓存/空白但应用不崩 ----
        browser, context, page, errors = launch(pw)
        page.goto(PREVIEW_BASE + "/map", wait_until="domcontentloaded")
        wait_map(page)
        page.wait_for_function(
            "navigator.serviceWorker && navigator.serviceWorker.ready.then(r => !!r.active)",
            timeout=20000,
        )
        page.reload(wait_until="domcontentloaded")  # SW 控制后重载，让瓦片经 SW 缓存
        wait_map(page)
        controlled = page.evaluate("!!navigator.serviceWorker.controller")
        tiles_online = page.evaluate(
            "[...document.querySelectorAll('img.leaflet-tile')].filter(i => i.complete && i.naturalWidth > 0).length"
        )
        # 进入离线
        context.set_offline(True)
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector(".app-shell", timeout=20000)
        wait_map(page)
        shell_ok = page.locator(".app-nav, .app-header").count() > 0
        geo_text = page.text_content(".geo-source-bar") if page.locator(".geo-source-bar").count() else None
        n_paths = page.evaluate("document.querySelectorAll('.leaflet-overlay-pane path').length")
        tiles_offline = page.evaluate(
            "[...document.querySelectorAll('img.leaflet-tile')].filter(i => i.complete && i.naturalWidth > 0).length"
        )
        tiles_total_offline = page.evaluate(
            "[...document.querySelectorAll('img.leaflet-tile')].length"
        )
        ok3 = (
            shell_ok
            and geo_text == "本地离线数据"
            and n_paths > 30  # 省份 GeoJSON 离线可渲染
            and tiles_offline > 0  # 已访问瓦片离线仍显示（CacheFirst）
            and len(errors) == 0
        )
        r.record(
            ok3,
            "4.6-3 Offline 应用壳 + 本地 GeoJSON + 已缓存瓦片可用、不崩",
            f"SW控制={controlled}, 在线时瓦片渲染={tiles_online}, 离线后: 应用壳={shell_ok}, "
            f"数据源={geo_text!r}, 省份路径数={n_paths}, 瓦片 total={tiles_total_offline}, "
            f"离线可渲染={tiles_offline}, pageerror={errors}",
        )
        browser.close()

        # ---- 验收 4：安装横幅逻辑（isInstallable / isIOS 渲染条件 + 安装流程 + 安装后隐藏） ----
        # 4a: 桌面触发 beforeinstallprompt → 横幅出现；点「立即安装」触发 prompt；appinstalled 后隐藏
        browser, context, page, errors = launch(pw)
        page.goto(PREVIEW_BASE, wait_until="domcontentloaded")
        page.wait_for_selector(".app-shell", timeout=20000)
        banner_before = page.locator(".install-prompt").count()
        page.evaluate(
            """
            window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), {
              prompt: () => { window.__promptCalled = true; return Promise.resolve() },
              userChoice: Promise.resolve({ outcome: 'accepted' })
            }))
            """
        )
        page.wait_for_timeout(300)
        banner_visible = page.locator(".install-prompt").is_visible()
        title = page.text_content(".install-title") if banner_visible else None
        page.get_by_role("button", name="立即安装").click()
        page.wait_for_timeout(400)
        prompt_called = page.evaluate("window.__promptCalled === true")
        banner_after_install = page.locator(".install-prompt").count()
        ok4a = banner_before == 0 and banner_visible and title == "安装「旅行足迹」" and prompt_called and banner_after_install == 0
        r.record(
            ok4a,
            "4.6-4a 安装横幅出现→点击触发系统安装→安装后隐藏",
            f"初始横幅数={banner_before}, beforeinstallprompt 后可见={banner_visible}, "
            f"标题={title!r}, prompt()被调用={prompt_called}, 安装后横幅数={banner_after_install}",
        )
        browser.close()

        # 4b: 「以后再说」→ 横幅隐藏且会话内不再出现
        browser, context, page, errors = launch(pw)
        page.goto(PREVIEW_BASE, wait_until="domcontentloaded")
        page.wait_for_selector(".app-shell", timeout=20000)
        page.evaluate("window.dispatchEvent(new Event('beforeinstallprompt'))")
        page.wait_for_timeout(300)
        page.get_by_role("button", name="以后再说").click()
        page.wait_for_timeout(300)
        hidden_after_dismiss = page.locator(".install-prompt").count() == 0
        page.reload(wait_until="domcontentloaded")
        page.wait_for_selector(".app-shell", timeout=20000)
        page.evaluate("window.dispatchEvent(new Event('beforeinstallprompt'))")
        page.wait_for_timeout(300)
        still_hidden = page.locator(".install-prompt").count() == 0
        r.record(
            hidden_after_dismiss and still_hidden,
            "4.6-4b 「以后再说」隐藏且会话内不再出现",
            f"点击后隐藏={hidden_after_dismiss}, 重载后再触发仍隐藏={still_hidden}",
        )
        browser.close()

        # 4c: iOS UA → 无 beforeinstallprompt 也显示横幅（isIOS）；点安装展开静态提示
        browser, context, page, errors = launch(
            pw, mobile=True, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        )
        page.goto(PREVIEW_BASE, wait_until="domcontentloaded")
        page.wait_for_selector(".app-shell", timeout=20000)
        ios_banner = page.locator(".install-prompt").count() > 0
        if ios_banner:
            page.get_by_role("button", name="立即安装").click()
            page.wait_for_timeout(300)
            ios_hint = page.locator(".ios-hint").count() > 0
        else:
            ios_hint = False
        r.record(
            ios_banner and ios_hint,
            "4.6-4c iOS 无 beforeinstallprompt 时横幅显示（isIOS）且点击出静态提示",
            f"iOS 横幅显示={ios_banner}, 点击后静态提示={ios_hint}",
        )
        browser.close()

    r.dump("任务 4.6 PWA 离线化")


if __name__ == "__main__":
    main()
