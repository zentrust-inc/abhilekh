const $=id=>document.getElementById(id);
const el=(t,a={},...k)=>{const e=document.createElement(t);for(const[n,v]of Object.entries(a))n.startsWith('on')?e.addEventListener(n.slice(2),v):e.setAttribute(n,v);k.forEach(x=>e.append(x));return e};
const fmt=iso=>new Date(iso).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const api=async(p,o)=>{const r=await fetch(p,o);const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'Something went wrong.');e.status=r.status;e.body=j;throw e}return j};
const post=(p,b)=>api(p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b||{})});
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
      const pin=el('input',{type:'password',inputmode:'numeric',maxlength:'6',placeholder:'PIN',autocomplete:'current-password',style:'display:none;flex:1'}),err=el('div',{class:'mute',style:'color:#a01212;width:100%'});
      const stop=el('button',{class:'danger',onclick:async()=>{
        if(pin.style.display==='none'){pin.style.display='';stop.textContent='Confirm stop';pin.focus();return}
        try{await post('/api/shares/'+s.id+'/stop',{pin:pin.value});await load()}catch(e){err.textContent=e.message}}},'Stop sharing');
      row.append(stop,pin,err)}
    card.append(row,el('div',{class:'mute',style:'margin-top:8px'},'Who looked, and when:'));
    const ul=el('ul',{class:'log'});s.log.forEach(e=>ul.append(el('li',{},fmt(e.at)+' · '+e.t)));card.append(ul);
    box.append(card);
  }
}
async function load(){try{SH=(await api('/api/shares')).shares;render()}catch(e){if(e.status===401)return showAuth();throw e}}
let PHONE='',TICKET='';
const show=(...ids)=>['stepPhone','stepCode','stepPin'].forEach(i=>$(i).style.display=ids.includes(i)?'':'none');
function showAuth(){$('app').style.display='none';$('auth').style.display='';show('stepPhone')}
const authErr=e=>{$('authErr').textContent=e?e.message:''};
$('loginBtn').onclick=async()=>{authErr();try{await post('/api/auth/login',{phone:$('phone').value,pin:$('loginPin').value});$('loginPin').value='';await enter()}catch(e){authErr(e)}};
$('codeBtn').onclick=async()=>{authErr();PHONE=$('phone').value;try{const r=await post('/api/auth/code',{phone:PHONE});$('testCode').textContent=r.testCode?'Test mode, no SMS sent. Code: '+r.testCode:'';show('stepCode');$('code').focus()}catch(e){authErr(e)}};
$('verifyBtn').onclick=async()=>{authErr();try{const r=await post('/api/auth/verify',{phone:PHONE,code:$('code').value});TICKET=r.ticket;$('code').value='';
  $('pinIntro').textContent=r.isNew?'Welcome. Choose a 6-digit PIN. You will use it on this phone instead of an SMS.':'Set a new PIN. Other phones are signed out, and new shares wait 24 hours. You can still stop shares at once.';show('stepPin');$('pin1').focus()}catch(e){authErr(e)}};
$('pinBtn').onclick=async()=>{authErr();if($('pin1').value!==$('pin2').value)return authErr(new Error('The two PINs are not the same.'));
  try{await post('/api/auth/pin',{ticket:TICKET,pin:$('pin1').value});$('pin1').value=$('pin2').value='';await enter()}catch(e){authErr(e)}};
$('logoutBtn').onclick=async()=>{await post('/api/auth/logout');showAuth()};
let started=false;
async function enter(){
  let me;try{me=await api('/api/me')}catch(e){return showAuth()}
  $('auth').style.display='none';$('app').style.display='';$('who-am-i').textContent='Signed in: '+me.phone;
  $('paused').style.display=me.sharesPausedUntil?'':'none';
  if(me.sharesPausedUntil)$('paused').textContent='Your PIN was reset by SMS, so new shares are paused until '+fmt(me.sharesPausedUntil)+'. You can still stop shares.';
  if(!started){started=true;await setup()}else await load();
}
async function setup(){
  REC=await api('/api/record');
  REC.docs.forEach(d=>{const cb=el('input',{type:'checkbox',id:'d-'+d.id,checked:''});$('docs').append(el('label',{class:'opt',for:'d-'+d.id},cb,el('span',{},d.title,el('br'),el('span',{class:'mute'},d.facility+' · '+d.date))))});
  const mins=REC.testMode?[1,...REC.minutes]:REC.minutes;
  mins.forEach(m=>{const o=el('option',{value:m},LABEL[m]);if(m===1440)o.selected=true;$('dur').append(o)});
  $('create').onclick=async()=>{
    const docs=REC.docs.filter(d=>$('d-'+d.id).checked).map(d=>d.id);
    if(!docs.length){$('makeErr').textContent='Choose at least one report to share.';return}
    $('makeErr').textContent='';
    try{await post('/api/shares',{docs,who:$('who').value.trim(),minutes:+$('dur').value,pin:$('sharePin').value});$('who').value='';$('sharePin').value='';await load()}catch(e){$('makeErr').textContent=e.message}
  };
  await load();setInterval(()=>{if($('app').style.display!=='none')load()},10000); // pick up opens made on the doctor's phone
}
enter();
