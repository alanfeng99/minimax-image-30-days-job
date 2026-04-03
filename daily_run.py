#!/usr/bin/env python3
import json, subprocess, os, sys, time, shutil

BASE_DIR = os.path.expanduser("~/.openclaw/workspace/monthly-minimax-image/30day")
STATE_FILE = os.path.join(BASE_DIR, ".current_day")
PROMPTS_JSON = os.path.expanduser("~/.openclaw/workspace/monthly-minimax-image/29day_prompts.json")
LOG_FILE = os.path.join(BASE_DIR, "daily_run.log")
TEMP_DIR = "/tmp/minimax_gen"

API_KEY = "sk-cp-TunEis7pOTrjuKDkn-DT64fRl94QKm-TfIMGTcpzp9HZbOr5lh_1Df3DYQBUDUrEmkdZTfwpoBw0gXASqU7yOPO6wgtxCzqqbdsrtSgiJb_fXBb_TawBygU"
ENDPOINT = "https://api.minimax.io/v1/image_generation"

os.makedirs(BASE_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

with open(STATE_FILE) as f:
    lines = f.read().strip().split('\n')
CURRENT_DAY = int(lines[0].strip())
ts = time.strftime('%Y-%m-%d %H:%M:%S')

log = f"[{ts}] Starting Day {CURRENT_DAY}\n"
print(log)

data = json.load(open(PROMPTS_JSON))
prompts = sorted([p for p in data if p['day'] == CURRENT_DAY], key=lambda x: x['index'])
print(f"Found {len(prompts)} prompts for Day {CURRENT_DAY}")

if not prompts:
    print(f"No prompts defined for Day {CURRENT_DAY} — skipping. Define theme manually.")
    sys.exit(0)

DAY_DIR = os.path.join(BASE_DIR, f"day-{CURRENT_DAY:02d}")
os.makedirs(DAY_DIR, exist_ok=True)

ok_count = 0
fail_count = 0

for p in prompts:
    idx = p['index']
    filename = p['filename']
    OUTPUT_FILE = os.path.join(DAY_DIR, filename)
    payload_file = os.path.join(TEMP_DIR, f"task_{idx:02d}.json")
    resp_file = os.path.join(TEMP_DIR, f"resp_{idx:02d}.json")
    
    payload = {"model": "image-01", "prompt": p['prompt'], "image_size": p['aspect'], "num_images": 1}
    with open(payload_file, 'w') as f:
        json.dump(payload, f)
    
    start = time.time()
    result = subprocess.run([
        'curl', '-s', '-o', resp_file, '-w', '%{http_code}',
        '--max-time', '120',
        '-H', 'Authorization: Bearer ' + API_KEY,
        '-H', 'Content-Type: application/json',
        '--data-binary', '@' + payload_file,
        ENDPOINT
    ], capture_output=True, text=True)
    
    http_code = result.stdout.strip()
    duration = time.time() - start
    
    if http_code == '200':
        try:
            resp_data = json.load(open(resp_file))
            urls = resp_data.get('data', {}).get('image_urls', [])
            image_url = urls[0] if urls else ''
            if image_url:
                subprocess.run(['curl', '-s', '--max-time', '60', '-o', OUTPUT_FILE, image_url], check=True)
                size = os.path.getsize(OUTPUT_FILE)
                log_line = f"[{idx}/50] OK {duration:.1f}s size={size}B | {filename}\n"
                print(f"[{idx}/50] OK {duration:.1f}s | {filename}")
                ok_count += 1
            else:
                err = resp_data.get('base_resp', {}).get('status_msg', 'no_url')
                log_line = f"[{idx}/50] FAIL | {err}\n"
                print(f"[{idx}/50] FAIL | {err}")
                fail_count += 1
        except Exception as e:
            log_line = f"[{idx}/50] FAIL | {str(e)[:100]}\n"
            fail_count += 1
    else:
        try:
            resp_data = json.load(open(resp_file))
            err = resp_data.get('base_resp', {}).get('status_msg', 'http_' + http_code)
        except:
            err = 'http_' + http_code
        log_line = f"[{idx}/50] FAIL HTTP {http_code} | {err}\n"
        print(f"[{idx}/50] FAIL HTTP {http_code} | {err}")
        fail_count += 1
    
    with open(LOG_FILE, 'a') as f:
        f.write(log_line)
    
    time.sleep(3)
    if idx % 5 == 0:
        time.sleep(5)

next_day = CURRENT_DAY + 1
if next_day > 29:
    next_day = 1

with open(STATE_FILE, 'w') as f:
    f.write(f"{next_day}\n{time.strftime('%Y-%m-%d %H:%M:%S')}\nDay {CURRENT_DAY}: {ok_count} OK, {fail_count} FAIL\n")

with open(LOG_FILE, 'a') as f:
    f.write(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] Day {CURRENT_DAY} COMPLETE -- OK: {ok_count} | FAIL: {fail_count}\n")

print(f"Done: Day {CURRENT_DAY} -- {ok_count} OK, {fail_count} FAIL")
shutil.rmtree(TEMP_DIR, ignore_errors=True)
