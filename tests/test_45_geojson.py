"""任务 4.5 GeoJSON 本地化 —— 规格 §1.6 共 5 条验收。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Result, launch, DEV_BASE  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402


def wait_map(page):
    # 等待地图初始化完成：出现可见的 geo-source-bar 或 fallback-notice
    page.wait_for_selector(".geo-source-bar:visible, .fallback-notice:visible", timeout=20000)
    page.wait_for_timeout(800)


def count_paths(page):
    return page.evaluate("document.querySelectorAll('.leaflet-overlay-pane path').length")


def main():
    r = Result()
    with sync_playwright() as pw:
        # ---- 验收 1：请求指向本地 /data/china-provinces.json，不再请求 aliyun ----
        browser, context, page, errors = launch(pw)
        reqs = []
        page.on("request", lambda req: reqs.append(req.url))
        page.goto(DEV_BASE + "/map", wait_until="domcontentloaded")
        wait_map(page)
        local_reqs = [u for u in reqs if "china-provinces.json" in u]
        aliyun_reqs = [u for u in reqs if "geo.datav.aliyun.com" in u]
        source_text = page.text_content(".geo-source-bar") if page.locator(".geo-source-bar").count() else None
        ok = len(local_reqs) == 1 and local_reqs[0].endswith("/data/china-provinces.json") and not aliyun_reqs
        r.record(
            ok,
            "4.5-1 本地 GeoJSON 请求 + 无 aliyun 请求",
            f"本地请求={local_reqs}, aliyun请求={aliyun_reqs}, 数据源标注={source_text!r}",
        )
        browser.close()

        # ---- 验收 2：屏蔽 aliyun 域 → 省份着色正常渲染（走本地） ----
        browser, context, page, errors = launch(pw)
        context.route("**geo.datav.aliyun.com/**", lambda route: route.abort())
        page.goto(DEV_BASE + "/map", wait_until="domcontentloaded")
        wait_map(page)
        source_text = page.text_content(".geo-source-bar") if page.locator(".geo-source-bar").count() else None
        fallback_visible = page.locator(".fallback-notice").is_visible()
        n_paths = count_paths(page)
        # 省份多边形 30+，证明 GeoJSON 渲染成功
        ok = source_text == "本地离线数据" and not fallback_visible and n_paths > 30
        r.record(
            ok,
            "4.5-2 屏蔽 aliyun 后省份正常渲染（本地）",
            f"数据源={source_text!r}, 降级条显示={fallback_visible}, SVG路径数={n_paths}(>30 即省份多边形渲染), "
            f"pageerror={errors}",
        )
        browser.close()

        # ---- 验收 3：双失败 → 降级提示 + 城市标记仍在，不白屏无异常 ----
        browser, context, page, errors = launch(pw)
        context.route("**geo.datav.aliyun.com/**", lambda route: route.abort())
        context.route("**data/china-provinces.json", lambda route: route.abort())
        page.goto(DEV_BASE + "/map", wait_until="domcontentloaded")
        wait_map(page)
        notice = page.text_content(".fallback-notice") if page.locator(".fallback-notice").count() else None
        notice_visible = page.locator(".fallback-notice").is_visible()
        n_paths = count_paths(page)
        map_exists = page.locator(".map-container").count() > 0
        # mockData 3 城市 → 至少 3 个 circleMarker 路径
        ok = notice_visible and "省份边界数据加载失败" in (notice or "") and n_paths >= 3 and map_exists and len(errors) == 0
        r.record(
            ok,
            "4.5-3 双失败降级提示 + 城市标记仍在",
            f"降级提示={notice!r}, 可见={notice_visible}, SVG路径数={n_paths}(≥3 城市圆点), "
            f"地图容器存在={map_exists}, pageerror={errors}",
        )
        browser.close()

        # ---- 验收 4：重复进入 /map 不重复请求（内存缓存） ----
        browser, context, page, errors = launch(pw, mobile=True)
        reqs = []
        page.on("request", lambda req: reqs.append(req.url))
        page.goto(DEV_BASE + "/map", wait_until="domcontentloaded")
        wait_map(page)
        # SPA 导航：首页 → 地图（不整页刷新，模块缓存保持）
        page.get_by_role("link", name="首页").click()
        page.wait_for_timeout(400)
        page.get_by_role("link", name="地图").click()
        wait_map(page)
        local_reqs = [u for u in reqs if "china-provinces.json" in u]
        r.record(
            len(local_reqs) == 1,
            "4.5-4 重复进入 /map 仅 1 次本地请求",
            f"两次进入累计 china-provinces.json 请求数={len(local_reqs)}",
        )
        browser.close()

    r.dump("任务 4.5 GeoJSON 本地化")


if __name__ == "__main__":
    main()
