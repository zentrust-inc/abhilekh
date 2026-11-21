const $=id=>document.getElementById(id);
const el=(t,a={},...k)=>{const e=document.createElement(t);for(const[n,v]of Object.entries(a))n.startsWith('on')?e.addEventListener(n.slice(2),v):e.setAttribute(n,v);k.forEach(x=>e.append(x));return e};
const fmt=iso=>new Date(iso).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
(async()=>{
  const ph=$('doctor');ph.replaceChildren();
  const id=location.pathname.split('/').pop();
  const r=await fetch('/api/s/'+id);const j=await r.json().catch(()=>({}));
  if(r.status===404||r.status===429){ph.append(el('div',{class:'gone'},'This link is not valid.',el('div',{class:'mute',style:'font-weight:400;margin-top:6px'},'Ask the patient for a new link.')));return}
  if(r.status===410){ph.append(el('div',{class:'gone'},j.state==='revoked'?'This share was stopped by the patient.':'This share has run out of time.',el('div',{class:'mute',style:'font-weight:400;margin-top:6px'},'Ask the patient for a new link.')));return}
  ph.append(el('div',{class:'mute'},'SAMPLE · नमूना · patient-confirmed record · visible until '+fmt(j.expires)));
  for(const d of j.docs){
    const c=el('div',{class:'card',style:'margin-top:10px'});
    c.append(el('h2',{},d.title),el('div',{class:'mute'},d.facility+' · '+d.patient+' · '+d.date_as_written));
    d.results.forEach(r=>{
      const row=el('div',{class:'res'});
      row.append(el('div',{class:'t'},r.test),el('div',{class:'v'},r.value+' ',el('span',{class:'u'},r.unit||''),r.flag?el('span',{class:'flag',title:'printed on the paper'},r.flag):''));
      row.append(el('div',{class:'mute'},'Printed range: '+(r.range||'—')+(r.flag?' · flag printed on the paper: '+r.flag:'')));
      if(r.img){const im=el('img',{class:'crop',src:r.img,alt:'Region of the original page for '+r.test,style:'display:none'});row.append(el('button',{class:'orig',onclick:()=>{im.style.display=im.style.display==='none'?'block':'none'}},'See the original'),im)}
      else row.append(el('div',{class:'mute'},'Original region not found; see the whole page.'));
      c.append(row)});
    ph.append(c);
  }
  ph.append(el('p',{class:'mute'},'Only what the paper says: value, unit, printed range and any printed flag. Abhilekh gives no advice.'));
})();
