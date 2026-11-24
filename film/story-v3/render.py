"""Render index.html to video: seek each frame, screenshot, pipe to ffmpeg.

python3 render.py OUT.mp4 [workers] [start end]   (seconds; default whole film)
Each worker renders one contiguous segment to its own mp4 (same settings);
segments are joined with the concat demuxer. Sound is added separately.
"""
import asyncio, os, subprocess, sys, time
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(HERE, 'index.html') + '?render'
FPS, W, H = 60, 1920, 1080


async def worker(idx, f0, f1, out):
    tmp = out + '.tmp.mp4'
    ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(FPS),
                           '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
                           '-pix_fmt', 'yuv420p', '-r', str(FPS), tmp], stdin=subprocess.PIPE)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': W, 'height': H})
        await pg.goto(URL)
        await pg.wait_for_function('window.FILM && window.FILM.ready', timeout=30000)
        t0 = time.time()
        for f in range(f0, f1):
            await pg.evaluate(f'FILM.seek({f / FPS:.6f})')
            ff.stdin.write(await pg.screenshot(type='jpeg', quality=92))
            if (f - f0) % 300 == 0:
                print(f'w{idx} frame {f} ({(f - f0) / max(time.time() - t0, 1e-6):.1f} fps)', flush=True)
        await b.close()
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit(f'ffmpeg failed for {out}')
    os.replace(tmp, out)


async def main():
    out = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    s0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    s1 = float(sys.argv[4]) if len(sys.argv) > 4 else 80.0
    F0, F1 = round(s0 * FPS), round(s1 * FPS)
    step = -(-(F1 - F0) // n)
    segs = []
    jobs = []
    for i in range(n):
        a, b = F0 + i * step, min(F0 + (i + 1) * step, F1)
        if a >= b:
            break
        seg = f'{out}.part{i}.mp4'
        segs.append(seg)
        jobs.append(worker(i, a, b, seg))
    await asyncio.gather(*jobs)
    lst = out + '.txt'
    with open(lst, 'w') as f:
        f.writelines(f"file '{os.path.abspath(s)}'\n" for s in segs)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', out], check=True)
    for s in segs:
        os.remove(s)
    os.remove(lst)
    print('done', out)

asyncio.run(main())
