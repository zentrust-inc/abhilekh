const $=id=>document.getElementById(id);
const el=(t,a={},...k)=>{const e=document.createElement(t);for(const[n,v]of Object.entries(a))n.startsWith('on')?e.addEventListener(n.slice(2),v):e.setAttribute(n,v);k.forEach(x=>e.append(x));return e};
const fmt=iso=>new Date(iso).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const api=async(p,o)=>{const r=await fetch(p,o);const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Something went wrong.');return j};
let REC={docs:[]},SH=[];
const qrSvg=url=>{const q=qrcode(0,'M');q.addData(url);q.make();return q.createSvgTag({cellSize:4,margin:2,scalable:true})};
const LABEL={60:'1 hour',1440:'24 hours',10080:'7 days',1:'1 minute (test only)'};
function render(){
  $('shHead').style.display=SH.length?'':'none';
  const box=$('shares');box.replaceChildren();
  for(const s of SH){
    const live=s.state==='live',url=location.origin+'/s/'+s.id;
    const card=el('div',{class:'card'+(live?'':' off')});
    card.append(el('div',{},el('span',{class:'pill '+(live?'live':'dead')},live?'Active':(s.state==='revoked'?'Stopped by you':'Time ran out')),' ',el('span',{class:'mute'},(live?'until ':'ended ')+fmt(s.state==='revoked'?s.revokedAt:s.expires))));
    card.append(el('div',{class:'t',style:'margin-top:6px'},s.who||'Doctor (no name given)'),el('div',{class:'mute'},s.docs.map(id=>(REC.docs.find(d=>d.id===id)||{title:id}).title).join(', ')));
    if(live){const qb=el('div',{class:'qr'});qb.innerHTML=qrSvg(url);card.append(qb,el('div',{class:'url'},url));}
    const row=el('div',{class:'row'});
    if(live){row.append(el('a',{href:url,target:'_blank',rel:'noopener'},el('button',{class:'sec',style:'width:100%'},'Open the link')));
      row.append(el('button',{class:'danger',onclick:async()=>{await api('/api/shares/'+s.id+'/stop',{method:'POST'});await load()}},'Stop sharing'))}
    card.append(row,el('div',{class:'mute',style:'margin-top:8px'},'Who looked, and when:'));
    const ul=el('ul',{class:'log'});s.log.forEach(e=>ul.append(el('li',{},fmt(e.at)+' · '+e.t)));card.append(ul);
    box.append(card);
  }
}
async function load(){SH=(await api('/api/shares')).shares;render()}
(async()=>{
  REC=await api('/api/record');
  REC.docs.forEach(d=>{const cb=el('input',{type:'checkbox',id:'d-'+d.id,checked:''});$('docs').append(el('label',{class:'opt',for:'d-'+d.id},cb,el('span',{},d.title,el('br'),el('span',{class:'mute'},d.facility+' · '+d.date))))});
  const mins=REC.testMode?[1,...REC.minutes]:REC.minutes;
  mins.forEach(m=>{const o=el('option',{value:m},LABEL[m]);if(m===1440)o.selected=true;$('dur').append(o)});
  $('create').onclick=async()=>{
    const docs=REC.docs.filter(d=>$('d-'+d.id).checked).map(d=>d.id);
    if(!docs.length){$('makeErr').textContent='Choose at least one report to share.';return}
    $('makeErr').textContent='';
    try{await api('/api/shares',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({docs,who:$('who').value.trim(),minutes:+$('dur').value})});$('who').value='';await load()}catch(e){$('makeErr').textContent=e.message}
  };
  await load();setInterval(load,10000); // pick up opens made on the doctor's phone
})();
