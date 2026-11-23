import asyncio, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1920,'height':1080})
        await pg.goto('file://' + os.path.abspath('ov.html')); await pg.wait_for_timeout(800)
        for id in ['story','planned','end']:
            await pg.evaluate("id=>{document.querySelectorAll('.f').forEach(e=>e.style.display='none');document.getElementById(id).style.display='block'}", id)
            await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'ov/{id}.png', omit_background=(id!='end'))
        await b.close()
asyncio.run(main())
