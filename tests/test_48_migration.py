"""任务 4.8 数据版本迁移机制 —— 规格 §3.6 共 5 条验收。"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import Result, launch, DEV_BASE  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

STORAGE_KEY = "travel_footprint_data"
QUARANTINE_KEY = "travel_footprint_data_corrupted"

# v1 旧数据：无 schemaVersion、成都 lat:0/lng:0 且缺 country/province，另有一正常城市
V1_DATA = {
    "version": "1.0",
    "visitedCities": [
        {
            "cityId": "c1",
            "cityName": "成都",
            "province": "",
            "country": "",
            "firstVisitDate": "2020-01-01",
            "visitCount": 1,
            "totalDays": 2,
            "scenicSpotIds": [],
            "memoryIds": ["m-old"],
            "lat": 0,
            "lng": 0,
        },
        {
            "cityId": "c2",
            "cityName": "济南",
            "province": "山东省",
            "country": "中国",
            "firstVisitDate": "2021-05-01",
            "visitCount": 2,
            "totalDays": 3,
            "scenicSpotIds": ["s1"],
            "memoryIds": [],
            "lat": 36.6512,
            "lng": 117.1201,
        },
    ],
    "scenicSpots": [
        {
            "spotId": "s1",
            "spotName": "趵突泉",
            "level": "5A",
            "city": "济南",
            "province": "山东省",
            "type": "人文景观",
            "status": "visited",
            "relatedMemoryIds": [],
            "lat": 36.6611,
            "lng": 117.0009,
        }
    ],
    "memories": [
        {
            "memoryId": "m-old",
            "title": "旧回忆",
            "startDate": "2020-01-01",
            "endDate": "2020-01-02",
            "companions": [],
            "tags": [],
            "content": "旧数据",
            "images": [],
            "cities": ["成都"],
            "spotIds": [],
            "createdAt": "2020-01-03T00:00:00Z",
            "updatedAt": "2020-01-03T00:00:00Z",
        }
    ],
}

OLD_EXPORT = json.dumps(V1_DATA, ensure_ascii=False)


def wait_app_ready(page):
    page.wait_for_selector(".app-shell", timeout=15000)
    page.wait_for_timeout(600)


def main():
    r = Result()
    with sync_playwright() as pw:
        # ---- 验收 1：全新访问 → schemaVersion === 2 ----
        browser, context, page, errors = launch(pw)
        page.goto(DEV_BASE, wait_until="domcontentloaded")
        wait_app_ready(page)
        stored = page.evaluate(f"JSON.parse(localStorage.getItem('{STORAGE_KEY}'))")
        sv = stored.get("schemaVersion")
        r.record(
            sv == 2,
            "4.8-1 全新访问写入 schemaVersion=2",
            f"实际 schemaVersion={sv}, version={stored.get('version')}",
        )
        browser.close()

        # ---- 验收 2：手工写入 v1 数据 → 刷新后迁移 ----
        browser, context, page, errors = launch(pw)
        context.add_init_script(
            f"localStorage.setItem('{STORAGE_KEY}', JSON.stringify({json.dumps(V1_DATA, ensure_ascii=False)}))"
        )
        page.goto(DEV_BASE, wait_until="domcontentloaded")
        wait_app_ready(page)
        stored2 = page.evaluate(f"JSON.parse(localStorage.getItem('{STORAGE_KEY}'))")
        ok_mig = stored2.get("schemaVersion") == 2 and stored2.get("version") == "2.0"
        chengdu = next((c for c in stored2["visitedCities"] if c["cityName"] == "成都"), None)
        ok_country = chengdu is not None and chengdu.get("country") == "中国"
        ok_lat = chengdu is not None and chengdu.get("lat") == 30.5728 and chengdu.get("lng") == 104.0668
        ok_keep = (
            len(stored2["visitedCities"]) == 2
            and len(stored2["scenicSpots"]) == 1
            and len(stored2["memories"]) == 1
            and any(c["cityName"] == "济南" for c in stored2["visitedCities"])
            and any(s["spotName"] == "趵突泉" for s in stored2["scenicSpots"])
            and any(m["memoryId"] == "m-old" for m in stored2["memories"])
        )
        r.record(
            ok_mig and ok_country and ok_lat and ok_keep,
            "4.8-2 v1 数据迁移（schemaVersion/country/lat 回填/数据不丢）",
            f"schemaVersion={stored2.get('schemaVersion')}, version={stored2.get('version')}, "
            f"成都 country={chengdu and chengdu.get('country')}, lat={chengdu and chengdu.get('lat')}, "
            f"lng={chengdu and chengdu.get('lng')}, 城市数={len(stored2['visitedCities'])}, "
            f"景点数={len(stored2['scenicSpots'])}, 回忆数={len(stored2['memories'])}",
        )
        browser.close()

        # ---- 验收 3：非法 JSON → 隔离且原值不被覆盖，应用以 mockData 启动 ----
        browser, context, page, errors = launch(pw)
        context.add_init_script(f"localStorage.setItem('{STORAGE_KEY}', '{{bad')")
        page.goto(DEV_BASE, wait_until="domcontentloaded")
        wait_app_ready(page)
        orig = page.evaluate(f"localStorage.getItem('{STORAGE_KEY}')")
        q_list = page.evaluate(f"JSON.parse(localStorage.getItem('{QUARANTINE_KEY}') || '[]')")
        ok_orig = orig == "{bad"
        ok_q = len(q_list) >= 1 and q_list[0].get("raw") == "{bad"
        # 单次加载去重：一次加载中 loadState 会被多次调用（3×store init + watcher），同 raw 只保留 1 条
        ok_dedup_single = len(q_list) == 1
        # 应用以 mockData 启动：进 /manage 看已记录城市 chips（济南/南京/北京）
        page.goto(DEV_BASE + "/manage", wait_until="domcontentloaded")
        page.get_by_role("button", name="添加城市足迹").first.click()
        page.wait_for_selector(".city-chips .chip", timeout=10000)
        chips = page.evaluate("[...document.querySelectorAll('.city-chips .chip')].map(e => e.textContent)")
        ok_mock = set(chips) == {"济南", "南京", "北京"}
        r.record(
            ok_orig and ok_q and ok_dedup_single and ok_mock and len(errors) == 0,
            "4.8-3 非法 JSON 隔离且原值保留、mockData 正常启动（含单次加载去重）",
            f"STORAGE_KEY 原值保留={'是' if ok_orig else '否(被覆盖为 ' + (orig or '')[:40] + ')'}, "
            f"隔离区含原始串={'是' if ok_q else '否'}, 单次加载隔离条数={len(q_list)}(应为1, 去重生效), "
            f"应用内城市 chips={chips}, pageerror={errors}",
        )
        # 跨多次加载去重：同一损坏串再刷新 2 次，隔离区仍只 1 条
        for _ in range(2):
            page.goto(DEV_BASE, wait_until="domcontentloaded")
            wait_app_ready(page)
        q_after = page.evaluate(f"JSON.parse(localStorage.getItem('{QUARANTINE_KEY}') || '[]')")
        r.record(
            len(q_after) == 1 and q_after[0].get("raw") == "{bad",
            "4.8-3c 同一损坏串多次加载隔离区仅 1 条（跨加载去重）",
            f"3 次加载后隔离条数={len(q_after)}, raw={q_after[0].get('raw') if q_after else None}",
        )
        # 隔离区保留最近 5 份（不同损坏串）：独立 context（无 init script 干扰），逐个注入不同串并刷新
        browser, context, page, errors = launch(pw)
        for i in range(6):
            page.goto(DEV_BASE, wait_until="domcontentloaded")
            wait_app_ready(page)
            page.evaluate(f"localStorage.setItem('{STORAGE_KEY}', '{{bad{i}')")
            page.reload(wait_until="domcontentloaded")
            wait_app_ready(page)
        q5 = page.evaluate(f"JSON.parse(localStorage.getItem('{QUARANTINE_KEY}') || '[]')")
        raws = [e.get("raw") for e in q5]
        ok_cap = len(q5) == 5 and set(raws) == {"{bad1", "{bad2", "{bad3", "{bad4", "{bad5"}
        r.record(
            ok_cap,
            "4.8-3b 隔离区保留最近 5 份（不同损坏串）",
            "实际份数={}（应=5）, raw 集合={}（应保留最近的 bad1..bad5）".format(len(q5), sorted(raws)),
        )
        browser.close()

        # ---- 验收 4：导入旧导出文件（无 schemaVersion）→ 成功且写回 schemaVersion=2 ----
        browser, context, page, errors = launch(pw)
        page.goto(DEV_BASE + "/manage", wait_until="domcontentloaded")
        wait_app_ready(page)
        tmp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_old_export.json")
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(OLD_EXPORT)
        page.set_input_files("input[type=file]", tmp)
        page.wait_for_selector(".status-banner", timeout=10000)
        banner = page.text_content(".status-banner")
        imported = page.evaluate(f"JSON.parse(localStorage.getItem('{STORAGE_KEY}'))")
        ok_sv = imported.get("schemaVersion") == 2 and imported.get("version") == "2.0"
        ok_data = any(c["cityName"] == "成都" for c in imported["visitedCities"])
        os.remove(tmp)
        r.record(
            ok_sv and ok_data and "已成功导入" in (banner or ""),
            "4.8-4 导入旧导出文件兼容并升级",
            f"导入提示={banner}, 写回 schemaVersion={imported.get('schemaVersion')}, "
            f"version={imported.get('version')}, 成都存在={'是' if ok_data else '否'}",
        )
        browser.close()

    r.dump("任务 4.8 数据版本迁移机制")


if __name__ == "__main__":
    main()
