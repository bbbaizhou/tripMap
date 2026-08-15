# -*- coding: utf-8 -*-
"""任务 B 验收：B.6-1..7 store 写入口入队行为（浏览器端，纯本地模式运行亦可）。"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import (  # noqa: E402
    App, BASE_URL, call_store, check, read_data, read_queue, reset_storage,
    seed_data_json, summary, v1_state_json, QUEUE_KEY, DATA_KEY,
)
from playwright.sync_api import sync_playwright  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')
BASE = Path(r'E:\vscodeProject\tripMap')


# ---------------- UI 动作辅助 ----------------
def ui_add_city(page, name='验收城市甲', province='四川省', date='2024-02-01', lat='30.57', lng='104.06'):
    page.goto(BASE_URL + '/manage')
    page.click('.tab:has-text("添加城市足迹")')
    page.fill('input[placeholder="如：成都"]', name)
    page.fill('input[placeholder="如：四川省"]', province)
    page.fill('input[type="date"]', date)
    page.fill('input[placeholder="如：30.5728"]', lat)
    page.fill('input[placeholder="如：104.0668"]', lng)
    page.click('.submit-btn:has-text("添加城市足迹")')
    page.wait_for_selector(f'.form-success:has-text("已添加城市")', timeout=5000)
    page.wait_for_timeout(200)


def ui_add_spot(page, name='验收景点甲', city='乐山', province='四川省'):
    page.goto(BASE_URL + '/manage')
    page.click('.tab:has-text("添加景点")')
    page.fill('input[placeholder="如：峨眉山"]', name)
    page.fill('input[placeholder="如：乐山"]', city)
    page.fill('input[placeholder="如：四川省"]', province)
    page.click('.submit-btn:has-text("添加到心愿单")')
    page.wait_for_selector(f'.form-success:has-text("已添加景点")', timeout=5000)
    page.wait_for_timeout(200)


def ui_add_memory(page, title='验收回忆甲'):
    page.goto(BASE_URL + '/memory/new')
    page.fill('input[placeholder="给这次旅行起个名字..."]', title)
    page.click('.btn-submit:has-text("发布回忆")')
    page.wait_for_url('**/memory/m*', timeout=5000)
    page.wait_for_timeout(200)
    mid = page.url.rstrip('/').split('/')[-1]
    return mid


def ui_update_memory(page, memory_id, new_title='验收回忆甲-改'):
    page.goto(f'{BASE_URL}/memory/{memory_id}/edit')
    page.fill('input[placeholder="给这次旅行起个名字..."]', new_title)
    page.click('.btn-submit:has-text("保存修改")')
    page.wait_for_url(f'**/memory/{memory_id}', timeout=5000)
    page.wait_for_timeout(200)


def ui_delete_memory(page, memory_id):
    page.goto(f'{BASE_URL}/memory/{memory_id}')
    page.wait_for_selector('.delete-btn', timeout=5000)
    page.click('.delete-btn')
    page.click('.delete-btn')  # 二次确认「确认删除？」
    page.wait_for_url('**/memories', timeout=5000)
    page.wait_for_timeout(200)


def ui_checkin_spot(page, spot_name):
    page.goto(BASE_URL + '/scenic')
    card = page.locator('.spot-card').filter(has_text=spot_name).first
    card.wait_for(timeout=8000)
    card.get_by_role('button', name='打卡').click()
    page.wait_for_selector('.dialog .btn-confirm', timeout=5000)
    page.click('.dialog .btn-confirm')
    page.wait_for_timeout(300)


def find_city_id(data, city_name):
    for c in data.get('visitedCities', []):
        if c['cityName'] == city_name:
            return c['cityId']
    return None


# ---------------- 测试主体 ----------------
with sync_playwright() as p:

    # ===== B.6-1 addCity/addSpot/addMemory → 队列新增对应 1 条 upsert（payload 为整条新记录） =====
    app = App(p)
    page = app.page
    reset_storage(page, 'seed')
    ui_add_city(page)
    q = read_queue(page)
    data = read_data(page)
    city_id = find_city_id(data, '验收城市甲')
    rec = next(c for c in data['visitedCities'] if c['cityId'] == city_id)
    items = [i for i in q if i['entity'] == 'cities']
    ok = (isinstance(q, list) and len(q) == 1 and len(items) == 1
          and items[0]['action'] == 'upsert' and items[0]['entityId'] == city_id
          and items[0].get('payload') == rec)
    check('B.6-1 addCity → 队列新增 1 条 cities/upsert，entityId 匹配，payload 为整条新记录',
          ok, f'total_queue={len(q) if isinstance(q, list) else q} entity_items={len(items)} cityId={city_id}')

    ui_add_spot(page)
    q = read_queue(page)
    data = read_data(page)
    spot_id = next(s['spotId'] for s in data['scenicSpots'] if s['spotName'] == '验收景点甲')
    srec = next(s for s in data['scenicSpots'] if s['spotId'] == spot_id)
    items = [i for i in q if i['entity'] == 'spots']
    ok = (isinstance(q, list) and len(q) == 2 and len(items) == 1
          and items[0]['action'] == 'upsert' and items[0]['entityId'] == spot_id
          and items[0].get('payload') == srec and items[0]['payload'].get('status') == 'wishlist')
    check('B.6-1 addSpot → 队列新增 1 条 spots/upsert，entityId 匹配，payload 为整条新记录',
          ok, f'total_queue={len(q) if isinstance(q, list) else q} entity_items={len(items)} spotId={spot_id}')

    mem_id = ui_add_memory(page)
    q = read_queue(page)
    data = read_data(page)
    mrec = next(m for m in data['memories'] if m['memoryId'] == mem_id)
    items = [i for i in q if i['entity'] == 'memories']
    ok = (isinstance(q, list) and len(q) == 3 and len(items) == 1
          and items[0]['action'] == 'upsert' and items[0]['entityId'] == mem_id
          and items[0].get('payload') == mrec and items[0]['payload'].get('title') == '验收回忆甲')
    check('B.6-1 addMemory → 队列新增 1 条 memories/upsert，entityId 匹配，payload 为整条新记录',
          ok, f'total_queue={len(q) if isinstance(q, list) else q} entity_items={len(items)} memoryId={mem_id}')
    app.close()

    # ===== B.6-2 update 同 id → 仍 1 条且 payload 最新（合并生效） =====
    app = App(p)
    page = app.page
    reset_storage(page, 'seed')
    ui_add_city(page)
    ui_add_spot(page)
    mem_id = ui_add_memory(page)
    city_id = find_city_id(read_data(page), '验收城市甲')
    spot_id = next(s['spotId'] for s in read_data(page)['scenicSpots'] if s['spotName'] == '验收景点甲')

    ui_update_memory(page, mem_id, '验收回忆甲-改')
    q = read_queue(page)
    items = [i for i in q if i['entity'] == 'memories' and i['entityId'] == mem_id]
    ok = (len(items) == 1 and items[0]['action'] == 'upsert'
          and items[0]['payload'].get('title') == '验收回忆甲-改'
          and items[0]['payload'].get('updatedAt') > '2020')
    check('B.6-2 updateMemory → 同 id 仍 1 条 upsert，payload 为最新标题',
          ok, f'items={json.dumps(items, ensure_ascii=False)[:300]}')

    ui_checkin_spot(page, '验收景点甲')
    q = read_queue(page)
    items = [i for i in q if i['entity'] == 'spots' and i['entityId'] == spot_id]
    ok = (len(items) == 1 and items[0]['action'] == 'upsert'
          and items[0]['payload'].get('status') == 'visited')
    check('B.6-2 toggleStatus(打卡) → 同 id 仍 1 条 upsert，payload.status=visited',
          ok, f'items={json.dumps(items, ensure_ascii=False)[:300]}')

    r = call_store(page, 'footprint', f"s.updateCity('{city_id}', {{ visitCount: 5 }});")
    page.wait_for_timeout(300)
    q = read_queue(page)
    items = [i for i in q if i['entity'] == 'cities' and i['entityId'] == city_id]
    ok = (r == 'OK' and len(items) == 1 and items[0]['action'] == 'upsert'
          and items[0]['payload'].get('visitCount') == 5
          and items[0]['payload'].get('totalDays') == 1
          and items[0]['payload'].get('cityName') == '验收城市甲')
    check('B.6-2 updateCity → 同 id 仍 1 条 upsert，payload 为最新合并记录',
          ok, f'store_ret={r} items={json.dumps(items, ensure_ascii=False)[:300]}')
    app.close()

    # ===== B.6-3 删除 → 同 id 变 1 条 delete（无 payload） =====
    app = App(p)
    page = app.page
    reset_storage(page, 'seed')
    ui_add_city(page)
    ui_add_spot(page)
    mem_id = ui_add_memory(page)
    city_id = find_city_id(read_data(page), '验收城市甲')
    spot_id = next(s['spotId'] for s in read_data(page)['scenicSpots'] if s['spotName'] == '验收景点甲')

    ui_delete_memory(page, mem_id)
    q = read_queue(page)
    items = [i for i in q if i['entity'] == 'memories' and i['entityId'] == mem_id]
    ok = (len(items) == 1 and items[0]['action'] == 'delete' and 'payload' not in items[0])
    check('B.6-3 deleteMemory → 同 id 1 条 delete 且无 payload',
          ok, f'items={json.dumps(items, ensure_ascii=False)[:300]}')

    r = call_store(page, 'footprint', f"s.removeCity('{city_id}');")
    page.wait_for_timeout(300)
    q = read_queue(page)
    items = [i for i in q if i['entity'] == 'cities' and i['entityId'] == city_id]
    ok = (r == 'OK' and len(items) == 1 and items[0]['action'] == 'delete' and 'payload' not in items[0])
    check('B.6-3 removeCity → 同 id 1 条 delete 且无 payload',
          ok, f'store_ret={r} items={json.dumps(items, ensure_ascii=False)[:300]}')

    r = call_store(page, 'scenic', f"s.removeSpot('{spot_id}');")
    page.wait_for_timeout(300)
    q = read_queue(page)
    items = [i for i in q if i['entity'] == 'spots' and i['entityId'] == spot_id]
    ok = (r == 'OK' and len(items) == 1 and items[0]['action'] == 'delete' and 'payload' not in items[0])
    check('B.6-3 removeSpot → 同 id 1 条 delete 且无 payload',
          ok, f'store_ret={r} items={json.dumps(items, ensure_ascii=False)[:300]}')
    app.close()

    # ===== B.6-4 刷新页面（数据全等 init）→ 队列长度不变（零噪声） =====
    app = App(p)
    page = app.page
    reset_storage(page, 'seed')
    ui_add_city(page)
    mem_id = ui_add_memory(page)
    q1 = read_queue(page)
    data1 = read_data(page)
    page.reload()
    page.wait_for_selector('.app-shell', timeout=8000)
    page.wait_for_timeout(300)
    q2 = read_queue(page)
    data2 = read_data(page)
    ok = (isinstance(q1, list) and isinstance(q2, list)
          and len(q1) == len(q2) == 2 and q1 == q2 and data1 == data2)
    check('B.6-4 刷新页面 → 队列长度不变、内容全等（零噪声）',
          ok, f'before={len(q1) if isinstance(q1, list) else q1} after={len(q2) if isinstance(q2, list) else q2} equal={q1 == q2}')
    app.close()

    # ===== B.6-5 fresh 初始化 & migration 写回 → 队列为空 =====
    app = App(p)
    page = app.page
    reset_storage(page, 'fresh')  # 清空数据 key → 首启 fresh 路径
    q = read_queue(page)
    data = read_data(page)
    ok = (q == [] and data is not None
          and len(data.get('visitedCities', [])) == 3)  # mockData 3 城市
    check('B.6-5 fresh 初始化（清 key 首启）→ 队列为空',
          ok, f'queue={q} data_cities={len(data.get("visitedCities", [])) if data else None}')

    reset_storage(page, 'seed', data=v1_state_json())  # v1 旧数据 → migration 写回
    q = read_queue(page)
    data = read_data(page)
    ok = (q == [] and data is not None and data.get('schemaVersion') == 2
          and data.get('version') == '2.0'
          and data['visitedCities'][0].get('country') == '中国')
    check('B.6-5 migration 写回 → 队列保持为空',
          ok, f'queue={q} schemaVersion={data.get("schemaVersion") if data else None} country={data["visitedCities"][0].get("country") if data else None}')
    app.close()

    # ===== B.6-6 队列 key 损坏 → 继续正常写数据（落盘成功、队列自愈） =====
    app = App(p)
    page = app.page
    reset_storage(page, 'seed', queue='{{{broken-json')
    ui_add_city(page, name='损坏队列恢复城')
    q = read_queue(page)
    data = read_data(page)
    city_found = any(c['cityName'] == '损坏队列恢复城' for c in data.get('visitedCities', []))
    ok = (isinstance(q, list) and len(q) == 1 and q[0]['entity'] == 'cities'
          and q[0]['action'] == 'upsert' and city_found)
    check('B.6-6 队列损坏 → 写数据成功（落盘）+ 队列自愈为合法 JSON 且含新写入',
          ok, f'queue={json.dumps(q, ensure_ascii=False)[:300]} city_persisted={city_found}')
    check('B.6-6b 队列损坏场景无页面 JS 错误', len(app.errors) == 0, f'errors={app.errors[:5]}')
    app.close()

    # ===== B.6-7 回归：导出 / 导入 / 隔离区 / 各页面 UI =====
    app = App(p)
    page = app.page
    reset_storage(page, 'seed')

    # 导出
    page.goto(BASE_URL + '/manage')
    page.wait_for_selector('.export-btn', timeout=5000)
    with page.expect_download() as dl_info:
        page.click('.export-btn')
    dl = dl_info.value
    export_path = dl.path()
    exported = json.loads(Path(export_path).read_text(encoding='utf-8'))
    ok = (exported.get('schemaVersion') == 2 and isinstance(exported.get('visitedCities'), list)
          and isinstance(exported.get('scenicSpots'), list) and isinstance(exported.get('memories'), list))
    check('B.6-7 回归-导出 JSON 结构完整', ok,
          f'filename={dl.suggested_filename} keys={list(exported.keys())}')

    # 导入（直接 saveState，按设计不入队）
    import_file = BASE / 'tests' / 'acceptance' / 'tmp_import.json'
    import_file.write_text(json.dumps({
        'schemaVersion': 2, 'version': '2.0',
        'visitedCities': [{
            'cityId': 'imp-1', 'cityName': '导入验收城', 'province': '云南省', 'country': '中国',
            'firstVisitDate': '2024-03-01', 'visitCount': 1, 'totalDays': 2,
            'scenicSpotIds': [], 'memoryIds': [], 'lat': 25.0, 'lng': 102.7,
        }],
        'scenicSpots': [], 'memories': [],
    }, ensure_ascii=False), encoding='utf-8')
    page.set_input_files('input[type="file"]', str(import_file))
    page.wait_for_selector('.status-banner.success', timeout=5000)
    page.wait_for_timeout(2500)  # 等 1.2s 后的自动刷新
    data = read_data(page)
    imported_ok = any(c['cityName'] == '导入验收城' for c in data.get('visitedCities', []))
    q = read_queue(page)
    check('B.6-7 回归-导入成功且按设计不入队（队列仍空）',
          imported_ok and q == [], f'imported={imported_ok} queue={q}')
    import_file.unlink(missing_ok=True)

    # 隔离区
    reset_storage(page, 'corrupt', data='not-json{{{')
    page.wait_for_selector('.app-shell', timeout=8000)
    quar = page.evaluate("() => localStorage.getItem('travel_footprint_data_corrupted')")
    raw_now = page.evaluate("() => localStorage.getItem('travel_footprint_data')")
    parsed_quar = json.loads(quar) if quar else []
    ok = (isinstance(parsed_quar, list) and len(parsed_quar) >= 1
          and parsed_quar[0].get('raw') == 'not-json{{{'
          and raw_now == 'not-json{{{')  # 损坏现场保留、不被覆盖
    check('B.6-7 回归-损坏数据进隔离区且原值保留',
          ok, f'quarantine_entries={len(parsed_quar) if isinstance(parsed_quar, list) else quar} raw_preserved={raw_now == "not-json{{{"}')
    # 隔离态下 UI 仍可操作（内存态），patchState 不写回不入队
    ui_add_city(page, name='隔离态城市')
    data_still = page.evaluate("() => localStorage.getItem('travel_footprint_data')")
    q = read_queue(page)
    ok = (data_still == 'not-json{{{' and q == [])
    check('B.6-7 回归-隔离态下 UI 正常、不覆盖损坏现场、不入队',
          ok, f'data_preserved={data_still == "not-json{{{"} queue={q} errors={app.errors[:4]}')
    app.close()

    # 各页面 UI 渲染（无 JS 错误；过滤外部瓦片/GeoJSON 网络噪音）
    app = App(p)
    page = app.page
    reset_storage(page, 'seed')
    noise = ('openstreetmap', 'datav', 'tile', 'favicon', 'net::', 'Failed to load resource')
    page_ok = True
    for route in ['/', '/map', '/scenic', '/memories', '/manage']:
        before = len(app.errors)
        page.goto(BASE_URL + route)
        page.wait_for_selector('.app-shell', timeout=8000)
        page.wait_for_timeout(800)
        new_errors = [e for e in app.errors[before:] if not any(n in e for n in noise)]
        if new_errors:
            page_ok = False
            print(f'      [页面 {route}] 错误: {new_errors[:4]}')
        title = page.locator('h2').first.inner_text() if page.locator('h2').count() else '(无h2)'
        print(f'      [页面 {route}] 渲染标题={title!r} 本地JS错误={len(new_errors)}')
    check('B.6-7 回归-五个页面渲染正常且无本地 JS 错误', page_ok, '见上方逐页输出')
    app.close()

s = summary()
print(f"\n===== 任务B 汇总: {s['passed']}/{s['total']} 通过 =====")
sys.exit(0 if s['failed'] == 0 else 1)
