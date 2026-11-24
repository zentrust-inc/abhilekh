import asyncio, os
from playwright.async_api import async_playwright
SRC={'scene-1':'index.html','scene-2':'index.html','scene-3':'index.html','scene-4':'index.html','scene-5':'index.html','scene-7':'doctors/index.html','scene-8':'trust/index.html'}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':1300,'height':900}, device_scale_factor=4, reduced_motion='reduce')
        pg = await ctx.new_page()
        for n,page in SRC.items():
            await pg.goto('file://' + os.path.abspath('../../site-next/' + page))
            await pg.wait_for_timeout(600)
            await pg.evaluate("""(n)=>{const s=document.querySelector('svg.'+n);
              s.querySelectorAll('text').forEach(t=>{if(/FICTIONAL/.test(t.textContent)) t.style.display='none'});
              s.style.borderRadius='0'; s.style.boxShadow='none'; s.style.width='1200px'; s.style.height='auto'; s.style.maxWidth='none';
              document.querySelectorAll('*').forEach(e=>{e.style.animation='none';e.style.transition='none'});
              s.style.position='fixed'; s.style.left='0'; s.style.top='0'; s.style.zIndex='99999'; s.style.opacity='1'; s.style.transform='none';
              let a=s.parentElement; while(a){a.style.opacity='1'; a.style.transform='none'; a=a.parentElement}}""", n)
            await pg.wait_for_timeout(300)
            e = await pg.query_selector('svg.'+n)
            await e.screenshot(path=f'stills/{n}.png')
            bb = await e.bounding_box(); print(n, bb)
        await b.close()
asyncio.run(main())
