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
    if(live){const ne=window.i18n&&window.i18n.lang()==='ne';
      const msg=ne?'अभिलेख: मेरा चिकित्सा कागजातहरू तपाईंसँग साझा गरिएको छ। यो लिङ्क खोल्नुहोस्: '+url+' (यो '+fmt(s.expires)+' सम्म चल्छ, र म जुनसुकै बेला रोक्न सक्छु)।':'Abhilekh: my medical papers, shared with you. Open this link: '+url+' (it works until '+fmt(s.expires)+', and I can stop it any time).';
      row.append(el('a',{href:'https://wa.me/?text='+encodeURIComponent(msg),target:'_blank',rel:'noopener',style:'width:100%'},el('button',{class:'go',style:'width:100%;margin-top:0'},'Send by WhatsApp')),
        el('a',{href:url,target:'_blank',rel:'noopener'},el('button',{class:'sec',style:'width:100%'},'Open the link')));
      const err=el('div',{class:'mute',style:'color:#a01212;width:100%'});
      let armed=false,t=null;
      const stop=el('button',{class:'danger',onclick:async()=>{
        if(!armed){armed=true;stop.textContent='Yes, stop now';clearTimeout(t);t=setTimeout(()=>{armed=false;stop.textContent='Stop sharing'},5000);return}
        try{await post('/api/shares/'+s.id+'/stop',{});await load()}catch(e){err.textContent=e.message;armed=false;stop.textContent='Stop sharing'}}},'Stop sharing');
      row.append(stop,err)}
    card.append(row,el('div',{class:'mute',style:'margin-top:8px'},'Who looked, and when:'));
    const ul=el('ul',{class:'log'});s.log.forEach(e=>ul.append(el('li',{},fmt(e.at)+' · '+e.t)));card.append(ul);
    box.append(card);
  }
}
async function load(){try{SH=(await api('/api/shares')).shares;render();if(REC.docs)paint()}catch(e){if(e.status===401)return showAuth();throw e}}
window.addEventListener('langchange',()=>{if(SH&&document.getElementById('shares'))render()});
let PHONE='',TICKET='';
const show=(...ids)=>['stepWelcome','stepPhone','stepCode','stepPin'].forEach(i=>$(i).style.display=ids.includes(i)?'':'none');
function showDown(){$('app').style.display='none';$('auth').style.display='none';$('down').style.display=''}
$('downRetry').onclick=()=>enter();
let OTHER=false;
async function showAuth(){
  $('down').style.display='none';$('app').style.display='none';$('auth').style.display='';show('stepPhone');head(true);
  if(OTHER)return;
  try{const h=await api('/api/auth/hello');
    if(h.known&&$('stepPhone').style.display!=='none'){ // a returning browser: greet it, do not show the new-user form
      $('welcomeWho').textContent=h.label;
      const can=PK_ON&&PK_OK,pk=can&&h.passkeys>0; // both ways in are always shown when this phone can do fingerprint or face
      $('welcomePasskey').style.display=can?'':'none';$('welcomePasskey').disabled=!pk;
      $('welcomeNote').style.display=can&&!pk?'':'none';$('welcomeNote').textContent='Not turned on yet. Sign in with your PIN, then turn it on from the home screen.';
      $('welcomeOr').style.display=can?'':'none';$('welcomePinLbl').textContent='Your PIN (6 digits)';
      show('stepWelcome');head(false);if(!pk)$('welcomePin').focus()}}catch(e){}
}
const head=on=>{$('authHead').style.display=$('authSub').style.display=on?'':'none'};
$('welcomeOther').onclick=()=>{OTHER=true;authErr();show('stepPhone');head(true)};
$('welcomeBtn').onclick=async()=>{authErr();try{await post('/api/auth/login',{pin:$('welcomePin').value});$('welcomePin').value='';await enter()}catch(e){if(e.body&&e.body.needCode){OTHER=true;show('stepPhone');head(true)}authErr(e)}};
const authErr=e=>{$('authErr').textContent=e?e.message:''};
$('loginBtn').onclick=async()=>{authErr();try{await post('/api/auth/login',{id:$('phone').value,pin:$('loginPin').value});$('loginPin').value='';await enter()}catch(e){authErr(e)}};
$('codeBtn').onclick=async()=>{authErr();PHONE=$('phone').value;try{const r=await post('/api/auth/code',{id:PHONE});$('testCode').textContent=r.testCode?'Test mode, nothing sent. Code: '+r.testCode:'';show('stepCode');$('code').focus()}catch(e){authErr(e)}};
$('verifyBtn').onclick=async()=>{authErr();try{const r=await post('/api/auth/verify',{id:PHONE,code:$('code').value});TICKET=r.ticket;$('code').value='';
  $('pinIntro').textContent=r.isNew?'Welcome. Choose a 6-digit PIN. You will use it on this device instead of a code.':'Set a new PIN. Other devices are signed out, and new shares wait 24 hours. You can still stop shares at once.';show('stepPin');$('pin1').focus()}catch(e){authErr(e)}};
$('pinBtn').onclick=async()=>{authErr();if($('pin1').value!==$('pin2').value)return authErr(new Error('The two PINs are not the same.'));
  try{await post('/api/auth/pin',{ticket:TICKET,pin:$('pin1').value});$('pin1').value=$('pin2').value='';await enter()}catch(e){authErr(e)}};
$('logoutBtn').onclick=async()=>{await post('/api/auth/logout');OTHER=false;showAuth()};
// Fingerprint or face (passkeys). The phone's own unlock does the check; Abhilekh never sees a fingerprint or a face.
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const PK_OK=!!(window.PublicKeyCredential&&navigator.credentials&&window.AuthenticatorAttestationResponse&&'getPublicKey' in AuthenticatorAttestationResponse.prototype);
let PK_ON=false,ME=null;
// This device remembers that fingerprint or face is already on for it (the server only knows the account has some). Light use of browser storage.
const pkHere=()=>{try{return localStorage.getItem('abhPk')==='1'}catch(e){return false}};
const pkMark=on=>{try{on?localStorage.setItem('abhPk','1'):localStorage.removeItem('abhPk')}catch(e){}};
// Proof for creating or stopping a share: the PIN if typed, otherwise fingerprint or face on a phone set up for this account.
async function confirmAuth(pin){
  if(pin)return{pin};
  if(!(PK_ON&&PK_OK&&ME&&ME.passkeys>0))throw new Error('Enter your PIN.');
  try{
    const o=await post('/api/auth/passkey/begin',{purpose:'confirm'});
    const c=await navigator.credentials.get({publicKey:{challenge:unb64u(o.challenge),rpId:o.rpId,allowCredentials:o.allow.map(id=>({type:'public-key',id:unb64u(id)})),userVerification:'required',timeout:60000}});
    const r=c.response;
    return{passkey:{challenge:o.challenge,id:c.id,clientDataJSON:b64u(r.clientDataJSON),authenticatorData:b64u(r.authenticatorData),signature:b64u(r.signature)}};
  }catch(e){throw e.name==='NotAllowedError'?new Error('Cancelled. Type your PIN instead.'):e}
}
const pkErr=e=>{$('pkErr').textContent=e?(e.name==='NotAllowedError'?'Cancelled. Nothing was changed.':e.message):''};
let PINMODE=false;
function shareMode(){ // fingerprint or face is the normal way to confirm a share; the PIN is the backup
  const pk=!!(ME&&ME.passkeys>0&&PK_ON&&PK_OK);
  $('sharePinBox').style.display=(!pk||PINMODE)?'':'none';
  $('usePinInstead').style.display=(pk&&!PINMODE)?'':'none';
  $('create').textContent=pk&&!PINMODE?'Create share link (fingerprint or face)':'Create share link';
}
$('usePinInstead').onclick=()=>{PINMODE=true;shareMode();$('sharePin').focus()};
function pkShow(me){
  ME=me;
  $('pkNudge').style.display=(PK_ON&&PK_OK&&!(me.passkeys>0))?'':'none';
  shareMode();
  const n=me.passkeys||0;
  if(!n)pkMark(false); // turned off elsewhere: this device forgets too
  $('rowPk').style.display=PK_ON&&PK_OK?'':'none';
  if(!PK_ON||!PK_OK)return;
  const here=pkHere();
  $('pkText').textContent=here?'On for this device'+(n>1?' and '+(n-1)+' more':'')+'. One touch signs you in, and a touch confirms creating a share; your PIN still works.'
    :n?'On for '+n+' device'+(n>1?'s':'')+', not yet for this one. Add it to sign in with one touch here too.'
    :'Off. Turn it on to sign in with one touch instead of typing a PIN. Your device does the check; Abhilekh never sees a fingerprint or a face.';
  $('pkAdd').style.display=here?'none':'';$('pkOn').textContent=n?'Add this device':'Turn on for this device';$('pkOff').style.display=n?'':'none';
}
$('passkeyBtn').onclick=async()=>{authErr();try{
  const o=await post('/api/auth/passkey/begin',{purpose:'login'});
  const c=await navigator.credentials.get({publicKey:{challenge:unb64u(o.challenge),rpId:o.rpId,userVerification:'required',timeout:60000}});
  const r=c.response;
  await post('/api/auth/passkey/login',{challenge:o.challenge,id:c.id,clientDataJSON:b64u(r.clientDataJSON),authenticatorData:b64u(r.authenticatorData),signature:b64u(r.signature)});
  pkMark(true);
  await enter()}catch(e){authErr(e.name==='NotAllowedError'?new Error('Cancelled. Use your PIN or a code.'):e)}};
$('welcomePasskey').onclick=$('passkeyBtn').onclick;
$('pkOn').onclick=async()=>{pkErr();try{
  const o=await post('/api/auth/passkey/begin',{purpose:'register',pin:$('pkPin').value});
  const c=await navigator.credentials.create({publicKey:{rp:{id:o.rpId,name:'Abhilekh'},user:{id:unb64u(o.user.id),name:o.user.name,displayName:o.user.name},challenge:unb64u(o.challenge),pubKeyCredParams:o.algs.map(alg=>({type:'public-key',alg})),authenticatorSelection:{residentKey:'required',userVerification:'required'},excludeCredentials:o.exclude.map(id=>({type:'public-key',id:unb64u(id)})),attestation:'none',timeout:60000}});
  const r=c.response;
  const me=await post('/api/auth/passkey/register',{challenge:o.challenge,id:c.id,clientDataJSON:b64u(r.clientDataJSON),authenticatorData:b64u(r.getAuthenticatorData()),publicKey:b64u(r.getPublicKey()),publicKeyAlgorithm:r.getPublicKeyAlgorithm()});
  $('pkPin').value='';pkMark(true);pkShow(me)}catch(e){pkErr(e)}};
$('pkOff').onclick=async()=>{pkErr();try{const me=await post('/api/auth/passkey/remove');pkMark(false);pkShow(me)}catch(e){pkErr(e)}};
let started=false;
async function enter(){
  let me;try{me=await api('/api/me')}catch(e){return e.status===401?showAuth():showDown()}
  $('down').style.display='none';closeMenu();tab('home');
  $('auth').style.display='none';$('app').style.display='';$('who-am-i').textContent='Signed in: '+(me.label||me.phone);pkShow(me);
  $('paused').style.display=me.sharesPausedUntil?'':'none';
  if(me.sharesPausedUntil)$('paused').textContent='Your PIN was reset with a new code, so new shares are paused until '+fmt(me.sharesPausedUntil)+'. You can still stop shares.';
  if(!started){started=true;await setup()}else await load();
}
function tab(name){
  for(const t of ['home','papers','share'])$('tab-'+t).style.display=t===name?'':'none';
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===name));
  scrollTo(0,0);
}
document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$('tileShow').onclick=()=>tab('share');
const VIEWS={list:['vList','Menu'],pk:['vPk','Fingerprint or face'],pin:['vPin','Change PIN']};
function openMenu(v){$('ov').style.display='';for(const k in VIEWS)$(VIEWS[k][0]).style.display=k===v?'':'none';$('sheetTitle').textContent=VIEWS[v][1];$('acctBtn').setAttribute('aria-expanded',true);pkErr();$('pinMsg').textContent='';if(v==='pk'&&$('pkAdd').style.display!=='none')$('pkPin').focus()}
function closeMenu(){$('ov').style.display='none';$('acctBtn').setAttribute('aria-expanded',false)}
$('acctBtn').onclick=()=>openMenu('list');
$('sheetClose').onclick=closeMenu;
$('ov').onclick=e=>{if(e.target===$('ov'))closeMenu()};
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>openMenu('list'));
$('rowPk').onclick=()=>openMenu('pk');$('rowPin').onclick=()=>openMenu('pin');
$('pkNudgeBtn').onclick=()=>openMenu('pk');
$('pinChange').onclick=async()=>{const m=$('pinMsg');m.style.color='#a01212';m.textContent='';
  if($('newPin1').value!==$('newPin2').value){m.textContent='The two new PINs are not the same.';return}
  try{await post('/api/auth/pin/change',{pin:$('oldPin').value,newPin:$('newPin1').value});$('oldPin').value=$('newPin1').value=$('newPin2').value='';m.style.color='#1d6b4a';m.textContent='PIN changed. Your other devices stay signed in.'}catch(e){m.textContent=e.message}};
$('labelBtn').onclick=()=>{$('labelIn').value=REC.label||'';$('labelBox').style.display='';$('labelIn').focus()};
$('labelCancel').onclick=()=>{$('labelBox').style.display='none'};
$('labelSave').onclick=async()=>{try{REC=await post('/api/record/label',{label:$('labelIn').value});$('labelBox').style.display='none';paint();paintForm()}catch(e){alert(e.message)}};
$('trySample').onclick=async()=>{try{REC=await post('/api/record/sample');paint();paintForm()}catch(e){alert(e.message)}};
function resultRows(d){
  const box=el('div',{class:'res-list'});
  for(const r of d.results){
    const row=el('div',{class:'res'});
    row.append(el('div',{class:'t'},r.test),el('div',{class:'v'},r.value+' ',el('span',{class:'u'},r.unit||''),r.flag?el('span',{class:'flag',title:'printed on the paper'},r.flag):''));
    row.append(el('div',{class:'mute'},'Printed range: '+(r.range||'—')+(r.flag?' · flag printed on the paper: '+r.flag:'')));
    box.append(row);
  }
  return box;
}
function paint(){
  const n=REC.docs.length;
  $('homeTitle').textContent=REC.label?'Papers of '+REC.label.replace(/^papers of\s+/i,''):'Hello';
  $('labelBtn').textContent=REC.label?'Change name':'Add a name for this record';
  $('firstUse').style.display=n?'none':'';
  $('tileShow').disabled=!n;$('tileShowSub').textContent=n?'Choose papers, set the time':'Add a paper first';
  const hc=$('homeCards');hc.replaceChildren();
  if(n){
    const live=SH.filter(s=>s.state==='live').length;
    hc.append(el('button',{class:'card',style:'width:100%;text-align:left;font-weight:400;color:var(--ink)',onclick:()=>tab('papers')},el('b',{},n+' paper'+(n>1?'s':'')),el('div',{class:'mute'},'Tap to see them')));
    hc.append(el('button',{class:'card',style:'width:100%;text-align:left;font-weight:400;color:var(--ink)',onclick:()=>tab('share')},el('b',{},live?live+' active share'+(live>1?'s':''):'Nothing is being shared'),el('div',{class:'mute'},live?'Tap to see who looked':'Only you can see your papers')));
  }
  const pl=$('papers');pl.replaceChildren();
  if(!n)pl.append(el('div',{class:'card mute'},'No papers yet. Add a SAMPLE paper from Home.'));
  for(const d of REC.docs){
    const card=el('div',{class:'card'});
    const body=el('div',{style:'display:none'},resultRows(d));
    card.append(el('div',{},el('span',{class:'chip'},'SAMPLE')),el('div',{class:'t',style:'margin-top:6px'},d.title),el('div',{class:'mute'},d.facility+' · '+d.date),
      el('button',{class:'orig',type:'button',onclick:e=>{const o=body.style.display==='none';body.style.display=o?'':'none';e.target.textContent=o?'Hide what it says':'See what it says'}},'See what it says'),body);
    pl.append(card);
  }
}
function paintForm(){
  const n=REC.docs.length;
  $('docs').replaceChildren();
  $('noPapers').style.display=n?'none':'';$('create').disabled=!n;
  REC.docs.forEach(d=>{const cb=el('input',{type:'checkbox',id:'d-'+d.id,checked:''});$('docs').append(el('label',{class:'opt',for:'d-'+d.id},cb,el('span',{},d.title,el('br'),el('span',{class:'mute'},d.facility+' · '+d.date))))});
}
async function setup(){
  REC=await api('/api/record');
  const mins=REC.testMode?[1,...REC.minutes]:REC.minutes;
  mins.forEach(m=>{const o=el('option',{value:m},LABEL[m]);if(m===1440)o.selected=true;$('dur').append(o)});
  $('create').onclick=async()=>{
    const docs=REC.docs.filter(d=>$('d-'+d.id)&&$('d-'+d.id).checked).map(d=>d.id);
    if(!docs.length){$('makeErr').textContent='Choose at least one report to share.';return}
    $('makeErr').textContent='';
    try{await post('/api/shares',{docs,who:$('who').value.trim(),minutes:+$('dur').value,...await confirmAuth($('sharePin').value)});$('who').value='';$('sharePin').value='';await load()}catch(e){$('makeErr').textContent=e.message;if(/Cancelled|PIN/.test(e.message)){PINMODE=true;shareMode()}}
  };
  paint();paintForm();
  await load();setInterval(()=>{if($('app').style.display!=='none')load()},10000); // pick up opens made on the doctor's phone
}
const GERR={expired:'That sign-in took too long or came from another browser. Try again.',cancelled:'Google sign-in was cancelled.',failed:'Google sign-in did not work. Try again in a few minutes.',unverified:'This Google account has no verified email, so it cannot be used.',noaccount:'No Abhilekh account uses this Google account yet. Choose Continue with Google to create one.'};
(async()=>{
  const q=new URLSearchParams(location.search);
  try{const o=await api('/api/auth/options');for(const i of ['googleBtn','orLine','googleReset'])$(i).style.display=o.google?'':'none';PK_ON=!!o.passkey;$('passkeyBtn').style.display=PK_ON&&PK_OK?'':'none'}catch(e){}
  if(q.get('gerr')){history.replaceState(null,'','/');showAuth();authErr(new Error(GERR[q.get('gerr')]||'Google sign-in did not work. Try again.'));return}
  if(q.get('g')==='1'){history.replaceState(null,'','/');
    try{const r=await post('/api/auth/google/ticket');TICKET=r.ticket;showAuth();
      $('pinIntro').textContent=r.isNew?'Welcome. Choose a 6-digit PIN. Google signs you in on any device; the PIN protects sharing.':'Set a new PIN. Other devices are signed out, and new shares wait 24 hours. You can still stop shares at once.';
      show('stepPin');$('pin1').focus()}catch(e){showAuth();authErr(e)}
    return}
  enter();
})();

// ---- PIN keypad: big number buttons, dots that fill, and the next step happens by itself at six digits ----
// The original <input> stays (hidden) so the rest of the page reads and writes its value as before.
const PADS={};
function pinpad(key,ids,labels,onDone,opts={}){
  const ins=ids.map($);
  const vd=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  let idx=0;
  const host=el('div',{class:'pad',tabindex:'0',role:'group','aria-label':'PIN entry'});
  const lab=el('div',{class:'plabel'}),dots=el('div',{class:'dots','aria-live':'polite'}),err=el('div',{class:'perr'});
  let show=false;
  const dot=[...Array(6)].map(()=>el('i'));dot.forEach(d=>dots.append(d));
  const eye=el('button',{type:'button',class:'eye','aria-label':'Show digits','aria-pressed':'false',onclick:()=>{show=!show;eye.setAttribute('aria-pressed',show);eye.setAttribute('aria-label',show?'Hide digits':'Show digits');eye.textContent=show?'\u{1F648}':'\u{1F441}';paint()}},'\u{1F441}');
  const row=el('div',{class:'boxrow'});row.append(dots,eye);
  const cur=()=>vd.get.call(ins[idx]);
  const paint=()=>{const v=cur(),n=v.length;px.value=v;dot.forEach((d,i)=>{d.classList.toggle('on',i<n);d.classList.toggle('now',i===n);d.textContent=i<n?(show?v[i]:'\u25CF'):''});lab.textContent=labels[idx];dots.setAttribute('aria-label',n+' of 6 digits')};
  ins.forEach(i=>{Object.defineProperty(i,'value',{get(){return vd.get.call(i)},set(v){vd.set.call(i,v);if(!String(v)&&ins.every(x=>!vd.get.call(x)))idx=0;paint()}});
    i.style.display='none';const l=document.querySelector('label[for="'+i.id+'"]');if(l)l.style.display='none'});
  const press=d=>{if(!/^\d$/.test(d)||cur().length>=6)return;vd.set.call(ins[idx],cur()+d);err.textContent='';paint();
    if(cur().length===6){if(idx<ins.length-1)setTimeout(()=>{idx++;paint()},180);else setTimeout(()=>onDone(api),180)}};
  const back=()=>{if(!cur()&&idx>0){idx--}vd.set.call(ins[idx],cur().slice(0,-1));err.textContent='';paint()};
  const px=el('input',{class:'pxin',type:'tel',inputmode:'numeric',pattern:'[0-9]*',autocomplete:'off',maxlength:'6','aria-label':'PIN, six digits'});
  dots.append(px);
  px.addEventListener('input',()=>{const v=px.value.replace(/\D/g,'').slice(0,6),c=cur();
    if(v.length>c.length)for(const d of v.slice(c.length))press(d);else if(v.length<c.length)back();px.value=cur()});
  px.addEventListener('keydown',e=>{if(e.key==='Backspace'&&!cur()&&idx>0){e.preventDefault();back()}});
  host.append(lab,row,err);
  ins[0].parentNode.insertBefore(host,(document.querySelector('label[for="'+ids[0]+'"]')||ins[0]));
  const api={goto(i){idx=i;paint();px.focus()},reset(msg){ins.forEach(i=>vd.set.call(i,''));idx=0;err.textContent=msg||'';paint();px.focus()},error(m){err.textContent=m||''},host};
  paint();PADS[key]=api;
  if(opts.hide)opts.hide.forEach(i=>{$(i).style.display='none'});
  return api;
}
const autoReset=(p,ms)=>setTimeout(()=>p.reset(),ms||900); // after an attempt: empty keypad again (a wrong PIN, or the screen has changed)
pinpad('welcome',['welcomePin'],['Your PIN'],p=>{$('welcomeBtn').click();autoReset(p)},{hide:['welcomeBtn']});
pinpad('login',['loginPin'],['Your PIN'],p=>{if(!$('phone').value.trim()){p.reset('Type your number or email first.');$('phone').focus();return}$('loginBtn').click();autoReset(p)},{hide:['loginBtn']});
pinpad('setpin',['pin1','pin2'],['Choose a 6-digit PIN','Type the same PIN again'],p=>{
  if($('pin1').value!==$('pin2').value){p.reset('The two PINs are not the same. Start again.');return}
  $('pinBtn').click();autoReset(p,1200)},{hide:['pinBtn']});
pinpad('pk',['pkPin'],['Your PIN, to turn it on'],p=>{$('pkOn').click();autoReset(p)},{hide:['pkOn']});
pinpad('share',['sharePin'],['Your PIN, to confirm'],()=>{});
pinpad('change',['oldPin','newPin1','newPin2'],['Your current PIN','Choose a new 6-digit PIN','Type the new PIN again'],p=>{
  if($('newPin1').value!==$('newPin2').value){$('newPin1').value=$('newPin2').value='';p.goto(1);p.error('The two new PINs are not the same. Type the new PIN again.');return}
  $('pinChange').click();autoReset(p,1200)},{hide:['pinChange']});
