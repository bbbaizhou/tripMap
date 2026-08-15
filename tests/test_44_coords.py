"""任务 4.4 坐标自动解析 —— 规格 §4.6 共 7 条验收。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Result, launch, DEV_BASE  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402


def open_city_tab(page):
    page.goto(DEV_BASE + "/manage", wait_until="domcontentloaded")
    page.wait_for_selector(".tab-bar", timeout=15000)
    page.get_by_role("button", name="添加城市足迹").first.click()
    page.wait_for_timeout(200)


def inputs(page):
    city = page.locator('input[placeholder="如：成都"]')
    prov = page.locator('input[placeholder="如：四川省"]')
    lat = page.locator('input[placeholder="如：30.5728"]')
    lng = page.locator('input[placeholder="如：104.0668"]')
    return city, prov, lat, lng


def main():
    r = Result()
    with sync_playwright() as pw:
        # ---- 验收 1：输入「成都」防抖 300ms 后自动填 30.5728/104.0668 + 提示 ----
        browser, context, page, errors = launch(pw)
        open_city_tab(page)
        city, prov, lat, lng = inputs(page)
        city.fill("成都")
        page.wait_for_timeout(120)  # 未到 300ms 防抖窗口
        early_lat = lat.input_value()
        page.wait_for_timeout(500)  # 超过防抖
        late_lat, late_lng = lat.input_value(), lng.input_value()
        hint = page.text_content(".form-hint")
        ok = late_lat == "30.5728" and late_lng == "104.0668" and "已自动填充坐标" in (hint or "")
        r.record(
            ok,
            "4.4-1 「成都」→ 30.5728/104.0668 自动填充 + 提示",
            f"防抖前 lat={early_lat!r}(应空), 防抖后 lat={late_lat}, lng={late_lng}, "
            f"提示={hint!r}, 无需点击按钮",
        )
        browser.close()

        # ---- 验收 2：输入「北京」→ 39.9042/116.4074 ----
        browser, context, page, errors = launch(pw)
        open_city_tab(page)
        city, prov, lat, lng = inputs(page)
        city.fill("北京")
        page.wait_for_timeout(500)
        r.record(
            lat.input_value() == "39.9042" and lng.input_value() == "116.4074",
            "4.4-2 「北京」→ 39.9042/116.4074",
            f"lat={lat.input_value()}, lng={lng.input_value()}",
        )
        browser.close()

        # ---- 验收 3：省份为空时输入「成都」→ 省份自动填「四川省」 ----
        browser, context, page, errors = launch(pw)
        open_city_tab(page)
        city, prov, lat, lng = inputs(page)
        city.fill("成都")
        page.wait_for_timeout(500)
        r.record(
            prov.input_value() == "四川省",
            "4.4-3 省份自动填充「四川省」",
            f"province={prov.input_value()!r}",
        )
        browser.close()

        # ---- 验收 4：先手填 lat/lng 再输城市名 → 不覆盖 ----
        browser, context, page, errors = launch(pw)
        open_city_tab(page)
        city, prov, lat, lng = inputs(page)
        lat.fill("30")
        lng.fill("100")
        page.wait_for_timeout(100)
        city.fill("成都")
        page.wait_for_timeout(600)
        r.record(
            lat.input_value() == "30" and lng.input_value() == "100",
            "4.4-4 手填坐标不被自动覆盖",
            f"lat={lat.input_value()}, lng={lng.input_value()}（保持手填 30/100），"
            f"提示={page.text_content('.form-hint')!r}",
        )
        browser.close()

        # ---- 验收 5：未知城市「亚特兰蒂斯」→ 不填坐标、提示未找到、仍可手填提交 ----
        browser, context, page, errors = launch(pw)
        open_city_tab(page)
        city, prov, lat, lng = inputs(page)
        city.fill("亚特兰蒂斯")
        page.wait_for_timeout(500)
        hint = page.text_content(".form-hint")
        lat_empty, lng_empty = lat.input_value() == "", lng.input_value() == ""
        # 手动补全后提交
        prov.fill("未知省")
        lat.fill("10.1")
        lng.fill("20.2")
        page.locator('input[type="date"]').fill("2024-01-01")
        page.locator("button.submit-btn").click()
        page.wait_for_timeout(300)
        success = page.text_content(".form-success")
        r.record(
            lat_empty and lng_empty and "未找到" in (hint or "") and "已添加城市：亚特兰蒂斯" in (success or ""),
            "4.4-5 未知城市提示且可手填提交",
            f"lat空={lat_empty}, lng空={lng_empty}, 提示={hint!r}, 提交结果={success!r}",
        )
        browser.close()

        # ---- 验收 6：Offline 下功能照常（纯本地） ----
        browser, context, page, errors = launch(pw)
        page.goto(DEV_BASE + "/manage", wait_until="domcontentloaded")
        page.wait_for_selector(".tab-bar", timeout=15000)
        context.set_offline(True)
        page.get_by_role("button", name="添加城市足迹").first.click()
        page.wait_for_timeout(200)
        city, prov, lat, lng = inputs(page)
        city.fill("成都")
        page.wait_for_timeout(600)
        ok6 = lat.input_value() == "30.5728" and lng.input_value() == "104.0668"
        r.record(
            ok6 and len(errors) == 0,
            "4.4-6 Offline 下坐标自动填充照常",
            f"offline 后 lat={lat.input_value()}, lng={lng.input_value()}, pageerror={errors}",
        )
        browser.close()

    r.dump("任务 4.4 坐标自动解析")
    print("\n[4.4-7 静态检查] 见独立检查：源码 grep 无真实 API Key；npm run build 结果见构建验收。")


if __name__ == "__main__":
    main()
