"""Render the v3 UI layer (index.html?render&overlay) as transparent video (PNG-in-MOV), 30 fps."""
import asyncio, os, subprocess, sys, time
from playwright.async_api import async_playwright
URL='file:///home/claude/abhilekh/film/story-v3/index.html?render&overlay'
FPS,W,H=30,1920,1080
async def worker(i,f0,f1,out):
    tmp=out+'.tmp.mov'
    ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','image2pipe','-framerate',str(FPS),'-c:v','png','-i','-',
        '-c:v','png','-pix_fmt','rgba',tmp],stdin=subprocess.PIPE)
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':W,'height':H})
        await pg.goto(URL); await pg.wait_for_function('window.FILM && window.FILM.ready',timeout=30000)
        t0=time.time()
        for f in range(f0,f1):
            await pg.evaluate(f'FILM.seek({f/FPS:.6f})')
            ff.stdin.write(await pg.screenshot(type='png',omit_background=True))
            if (f-f0)%150==0: print(f'w{i} {f} {(f-f0)/max(time.time()-t0,1e-6):.1f}fps',flush=True)
        await b.close()
    ff.stdin.close()
    if ff.wait()!=0: raise SystemExit('ffmpeg fail')
    os.replace(tmp,out)
async def main():
    out=sys.argv[1]; n=int(sys.argv[2]); s0,s1=float(sys.argv[3]),float(sys.argv[4])
    F0,F1=round(s0*FPS),round(s1*FPS); step=-(-(F1-F0)//n); segs=[]; jobs=[]
    for i in range(n):
        a,b=F0+i*step,min(F0+(i+1)*step,F1)
        if a>=b: break
        s=f'{out}.part{i}.mov'; segs.append(s); jobs.append(worker(i,a,b,s))
    await asyncio.gather(*jobs)
    with open(out+'.txt','w') as f: f.writelines(f"file '{s}'\n" for s in segs)
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','concat','-safe','0','-i',out+'.txt','-c','copy',out],check=True)
    for s in segs: os.remove(s)
    print('done',out)
asyncio.run(main())
