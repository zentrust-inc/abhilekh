const $=id=>document.getElementById(id);
const el=(t,a={},...k)=>{const e=document.createElement(t);for(const[n,v]of Object.entries(a))n.startsWith('on')?e.addEventListener(n.slice(2),v):e.setAttribute(n,v);k.forEach(x=>e.append(x));return e};
const fmt=iso=>new Date(iso).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const api=async(p,o)=>{const r=await fetch(p,o);const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'Something went wrong.');e.status=r.status;e.body=j;throw e}return j};
const post=(p,b)=>api(p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b||{})});
let REC={docs:[]},SH=[];
const qrSvg=url=>{const q=qrcode(0,'M');q.addData(url);q.make();return q.createSvgTag({cellSize:4,margin:2,scalable:true})};
const LABEL={15:'15 minutes',1:'1 minute (test only)'};
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
async function load(){try{SH=(await api('/api/shares')).shares;if(REC.docs){REC=await api('/api/record');paintForm()}render();if(REC.docs)paint()}catch(e){if(e.status===401)return showAuth();throw e}}
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
// Enlarged photo inside the app (26 Nov 2026): the tab bar stays at the bottom; nothing opens outside Abhilekh.
function viewPhoto(id){
  closePhoto();
  const big=el('img',{class:'big',alt:'The original photo, as taken',src:'/api/papers/'+id+'/original'});
  const box=el('div',{class:'viewer',id:'viewer',role:'dialog','aria-label':'The original photo, as taken'},
    el('button',{class:'orig',type:'button',onclick:closePhoto},'\u2039 ',el('span',{},'Back')),
    el('div',{class:'mute'},'The original photo, as taken. Tap it to zoom in or out.'),
    el('div',{class:'pane'},big));
  big.onclick=()=>box.classList.toggle('zoom');
  document.body.append(box);
}
function closePhoto(){const v=document.getElementById('viewer');if(v)v.remove()}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePhoto()});
function tab(name){
  closePhoto();
  for(const t of ['home','papers','share','check'])$('tab-'+t).style.display=t===name?'':'none';
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
  for(const m of d.medicines||[]){const row=el('div',{class:'res'});medRows(row,m.as_written,m.register,m.dose,m.duration);box.append(row)}
  for(const r of d.results){
    const row=el('div',{class:'res'});
    row.append(el('div',{class:'t'},r.test),el('div',{class:'v'},r.value+' ',el('span',{class:'u'},r.unit||''),r.flag?el('span',{class:'flag',title:'printed on the paper'},r.flag):''));
    row.append(el('div',{class:'mute'},'Printed range: '+(r.range||'—')+(r.flag?' · flag printed on the paper: '+r.flag:'')));
    box.append(row);
  }
  return box;
}
// ---- family: whose papers are in view; changing person asks for the PIN (or fingerprint/face) ----
let TARGET=null;
function paintPeople(){
  const many=(REC.people||[]).length>1;
  $('personBtn').textContent=many?'Switch person':'Add a family member';
  const pl=$('peopleList');pl.replaceChildren();
  for(const p of REC.people||[]){
    const on=p.id===REC.person;
    pl.append(el('button',{type:'button',class:'opt-person'+(on?' on':'')+(TARGET===p.id?' pick':''),onclick:()=>{if(on)return;TARGET=p.id;$('peopleErr').textContent='';$('switchBox').style.display='';
      $('switchPk').style.display=(ME&&ME.passkeys>0&&PK_ON&&PK_OK)?'':'none';paintPeople();PADS.switch&&PADS.switch.reset()}},
      el('b',{},p.name||'(no name yet)'),el('span',{class:'mute'},' · '),el('span',{class:'mute'},on?'open now':p.papers+' paper'+(p.papers===1?'':'s'))));
  }
}
async function switchTo(proof){
  $('peopleErr').textContent='';
  try{REC=await post('/api/people/switch',{person:TARGET,...proof});TARGET=null;$('switchBox').style.display='none';$('peopleBox').style.display='none';paintForm();await load()}
  catch(e){$('peopleErr').textContent=e.message}
}
$('personBtn').onclick=()=>{const o=$('peopleBox').style.display==='none';$('peopleBox').style.display=o?'':'none';TARGET=null;$('switchBox').style.display='none';$('peopleErr').textContent='';paintPeople();if(o)$('peopleBox').scrollIntoView({block:'nearest'})};
$('peopleClose').onclick=()=>{$('peopleBox').style.display='none';TARGET=null};
$('switchGo').onclick=()=>switchTo({pin:$('switchPin').value});
$('switchPk').onclick=async()=>{try{await switchTo(await confirmAuth(''))}catch(e){$('peopleErr').textContent=e.message}};
$('addPerson').onclick=async()=>{$('peopleErr').textContent='';
  try{REC=await post('/api/people',{name:$('newPerson').value});$('newPerson').value='';$('peopleBox').style.display='none';paintForm();await load()}catch(e){$('peopleErr').textContent=e.message}};
// ---- photos: sent as taken; the server keeps the original and its SHA-256 ----
$('tilePhoto').onclick=()=>{const o=$('addPaper').style.display==='none';$('addPaper').style.display=o?'':'none';$('addMsg').textContent=''};
$('camBtn').onclick=()=>$('camIn').click();
$('galBtn').onclick=()=>$('galIn').click();
// One photo or many (chosen together from the gallery). Sent one at a time, so a weak connection only has to carry one;
// if one fails, the others still go, and the message says which did not.
async function sendPhotos(files){
  const m=$('addMsg');m.style.color='';files=[...files];if(!files.length)return;
  let kept=0,same=0;const failed=[];
  for(let i=0;i<files.length;i++){
    const f=files[i];
    m.textContent=files.length>1?'Keeping the originals: '+(i+1)+' of '+files.length:'Keeping the original…';
    if(f.size>15*1024*1024){failed.push(f.name+': larger than 15 MB');continue}
    try{const r=await api('/api/papers',{method:'POST',headers:{'content-type':f.type||'image/jpeg','x-abhilekh-upload':'1'},body:f});REC=r;r.already?same++:kept++;paint();paintForm()}
    catch(e){failed.push(f.name+': '+e.message)}
  }
  m.style.color=failed.length?'#a01212':'#1d6b4a';
  m.textContent=files.length===1&&!failed.length?(same?'This photo is already kept.':'Original kept. It will be read in the next step.')
    :[kept+' kept',same?same+' already kept':'',failed.length?failed.length+' not kept':''].filter(Boolean).join(' · ')+'.';
  if(failed.length)m.append(el('ul',{class:'log'},...failed.map(t=>el('li',{},t))));
}
$('camIn').onchange=e=>{sendPhotos(e.target.files);e.target.value=''};
$('galIn').onchange=e=>{sendPhotos(e.target.files);e.target.value=''};
// What the two readers found. Shown as copies of the paper only: agreed, for you to confirm, or Unresolved. Never a meaning.
const UNRES='Unresolved. Original document available.';
// The DDA register entry for a medicine line, matched on the exact name. Facts from the register, not advice.
function regLine(reg){
  if(!reg)return null;
  if(reg.mixed)return el('div',{class:'mute reg'},'On the DDA register: several products share this name ('+reg.products.map(p=>p.registered).slice(0,3).join('; ')+').');
  const p=reg.products[0];
  return el('div',{class:'mute reg'},'On the DDA register: '+[p.registered,p.manufacturer].filter(Boolean).join(' · ')+(p.valid?'':' · registration lapsed'));
}
// One medicine line, as it is shown everywhere: the medicine (without the form word in front), its form, the generic from the
// DDA register (exact name match only), how often and how long. The line as written stays whole in the record and on the photo.
function labelled(label,value,cls){return el('div',{class:cls||'mute'},el('span',{},label),': '+value)}
function medRows(row,asWritten,reg,dose,duration){
  const sp=medline.split(asWritten),form=medline.form(reg,sp),gen=medline.generic(reg);
  row.append(el('div',{class:'t'},sp.name||asWritten));
  if(form)row.append(el('div',{class:'mute'},el('span',{},'Form'),': ',el('span',{},form)));
  if(gen)row.append(labelled('Generic (DDA register)',gen,'reg'));
  if(dose)row.append(labelled('How often',dose));
  if(duration)row.append(labelled('How long',duration));
  const rl=regLine(reg);if(rl)row.append(rl);
}
function fv(f){if(!f||f.state==='empty')return '';return f.state==='unresolved'?UNRES:f.text}
function readingView(r){
  const box=el('div',{class:'res-list'});
  const line=(label,f)=>{if(!f||f.state==='empty')return;const row=el('div',{class:'res'});
    row.append(el('div',{class:'t'},label),el('div',{class:'v'+(f.state==='unresolved'?' unres':'')},fv(f)));
    if(f.state==='confirm')row.append(el('div',{class:'mute'},'Check this against the paper.'));box.append(row)};
  line('Date on the paper',r.date);line('Clinic, hospital or lab',r.facility);line('Doctor',r.clinician);
  for(const t of r.results){
    const row=el('div',{class:'res'});
    const name=t.test.state==='unresolved'?(t.test.a||t.test.b):t.test.text;
    row.append(el('div',{class:'t'},name),el('div',{class:'v'+(t.value.state==='unresolved'?' unres':'')},fv(t.value)+' ',el('span',{class:'u'},t.unit.state==='agreed'?t.unit.text:''),t.flag.state==='agreed'&&t.flag.text?el('span',{class:'flag',title:'printed on the paper'},t.flag.text):''));
    row.append(el('div',{class:'mute'},'Printed range: '+(t.range.state==='agreed'?t.range.text:t.range.state==='unresolved'?UNRES:'—')));
    if(t.value.state==='confirm')row.append(el('div',{class:'mute'},'Check this against the paper.'));
    if(t.test.state==='unresolved')row.append(el('div',{class:'mute'},'Only one reader saw this line.'));
    box.append(row);
  }
  for(const m of r.medicines){
    const row=el('div',{class:'res'});
    medRows(row,m.as_written.state==='unresolved'?(m.as_written.a||m.as_written.b):m.as_written.text,m.register,fv(m.dose),fv(m.duration));
    if(m.as_written.state==='unresolved')row.append(el('div',{class:'mute'},'The readers did not agree on this line. '+UNRES));
    if(m.as_written.byRegister)row.append(el('div',{class:'mute'},'The readers did not agree, but this copy is on the DDA register exactly. Check it against the paper.'));
    if(!m.register&&m.as_written.state!=='unresolved'&&m.dda==='not_found')row.append(el('div',{class:'mute'},'Not found on the DDA register: shown as written.'));
    box.append(row);
  }
  return box;
}
// ---- M3: check against the paper, then add to my record ----
// Agreed: filled in and ticked (the patient can still change it). A date: filled in only when both readers agree, and it
// needs its own tick (decided 25 Nov 2026); otherwise she types it. A value with a decimal point: needs its own tick.
// Unresolved: typed from the paper, or left Unresolved. There is no "confirm all".
function checkField(label,f,opt={}){
  const wrap=el('div',{class:'chk'});
  const st=f?f.state:'empty';
  const inp=el('input',{type:'text',value:st==='agreed'||st==='confirm'?f.text:'',maxlength:'200','aria-label':label});
  const tick=el('input',{type:'checkbox'});if(st==='agreed')tick.checked=true;
  const leave=el('input',{type:'checkbox'});
  const note=el('div',{class:'mute'});
  wrap.append(el('div',{class:'t'},label),inp);
  if(opt.date&&st==='confirm')note.textContent='Both readers read this date the same. Check it against the paper.';
  else if(opt.date){inp.placeholder='Type it exactly as printed';note.textContent='The readers did not agree on the date. Type it yourself, exactly as printed (any calendar).'}
  else if(st==='agreed')note.textContent='Both readers read this the same.';
  else if(st==='confirm')note.textContent='Has a decimal point: check it against the paper yourself.';
  else if(st==='unresolved'){inp.placeholder='Unresolved. Original document available.';note.textContent='The readers did not agree. Type it from the paper, or leave it Unresolved.'}
  wrap.append(note);
  if(st==='agreed'||st==='confirm')wrap.append(el('label',{class:'opt'},tick,el('span',{},'Matches the paper')));
  if(!opt.date&&st==='unresolved')wrap.append(el('label',{class:'opt'},leave,el('span',{},'Leave it Unresolved')));
  inp.addEventListener('input',()=>{if(st==='agreed'||st==='confirm')tick.checked=false;if(inp.value)leave.checked=false});
  return{node:wrap,get:()=>({value:inp.value.trim(),ok:tick.checked,unresolved:leave.checked}),
    done:()=>opt.date&&st!=='confirm'?!!inp.value.trim():st==='confirm'?tick.checked&&!!inp.value.trim():st==='unresolved'?(!!inp.value.trim()||leave.checked):true,mark:on=>wrap.classList.toggle('need',on)};
}
// How often: chosen from the usual ways it is written (shown exactly as written), or typed under "Other".
function doseField(f){
  const st=f?f.state:'empty',now=st==='agreed'?f.text:st==='unresolved'?(f.a||''):'';
  const wrap=el('div',{class:'chk'}),sel=el('select',{'aria-label':'How often'});
  sel.append(el('option',{value:''},'Choose from the paper'));
  medline.DOSES.forEach(d=>sel.append(el('option',{value:d},d)));
  sel.append(el('option',{value:'other'},'Other (type it as written)'),el('option',{value:'none'},'Not written on the paper'));
  const other=el('input',{type:'text',maxlength:'60',placeholder:'As written on the paper','aria-label':'How often, as written'});
  const tick=el('input',{type:'checkbox'}),leave=el('input',{type:'checkbox'}),note=el('div',{class:'mute'});
  if(st==='agreed'){const o=medline.doseOption(now);if(o)sel.value=o;else{sel.value='other';other.value=now}tick.checked=true;note.textContent='Both readers read this the same.'}
  else if(st==='unresolved')note.textContent='The readers did not agree. Choose it from the paper, or leave it Unresolved.';
  else sel.value='none';
  const show=()=>{other.style.display=sel.value==='other'?'':'none'};show();
  wrap.append(el('div',{class:'t'},'How often'),sel,other,note);
  if(st==='agreed')wrap.append(el('label',{class:'opt'},tick,el('span',{},'Matches the paper')));
  if(st==='unresolved')wrap.append(el('label',{class:'opt'},leave,el('span',{},'Leave it Unresolved')));
  sel.addEventListener('change',()=>{show();tick.checked=false;if(sel.value)leave.checked=false});
  other.addEventListener('input',()=>{tick.checked=false;if(other.value)leave.checked=false});
  const value=()=>sel.value==='other'?other.value.trim():sel.value==='none'?'':sel.value;
  return{node:wrap,get:()=>({value:value(),ok:true,none:sel.value==='none',unresolved:leave.checked}),
    done:()=>sel.value==='none'||!!value()||(st==='unresolved'&&leave.checked),mark:on=>wrap.classList.toggle('need',on)};
}
function openCheck(p){
  const r=p.reading,v=$('checkView');v.replaceChildren();tab('check');
  const fields=[];const add=(box,label,f,opt)=>{const c=checkField(label,f,opt);box.append(c.node);fields.push(c);return c};
  v.append(el('button',{class:'orig',type:'button',onclick:()=>tab('papers')},'\u2039 ',el('span',{},'Back to my papers')),el('h1',{},'Check against the paper'),
    el('p',{class:'sub'},'Look at the paper and at each line below. Nothing reaches a doctor until you add it to your record.'));
  const img=el('img',{class:'crop',alt:'The original photo, as taken',src:'/api/papers/'+p.id+'/original'});
  v.append(el('div',{class:'card'},img,el('div',{class:'mute'},'Tap the photo to see it larger.')));
  img.onclick=()=>viewPhoto(p.id);
  const top=el('div',{class:'card'});v.append(top);
  const date=add(top,'Date on the paper',r.date,{date:true});
  const fac=add(top,'Clinic, hospital or lab',r.facility);const doc=add(top,'Doctor',r.clinician);
  const rows=[],meds=[];
  if(r.results.length){v.append(el('h2',{},'Results'));}
  r.results.forEach(t=>{const c=el('div',{class:'card'});v.append(c);
    const row={removed:false,f:{}};
    const rm=el('button',{class:'orig',type:'button',onclick:()=>{row.removed=!row.removed;c.classList.toggle('off',row.removed);rm.textContent=row.removed?'Put this line back':'This line is not on the paper'}},'This line is not on the paper');
    row.f.test=add(c,'Test',t.test);row.f.value=add(c,'Value',t.value);row.f.unit=add(c,'Unit',t.unit);row.f.range=add(c,'Printed range',t.range);row.f.flag=add(c,'Flag printed by the lab',t.flag);
    c.append(rm);rows.push(row)});
  if(r.medicines.length){v.append(el('h2',{},'Medicines'));}
  r.medicines.forEach(m=>{const c=el('div',{class:'card'});v.append(c);
    const row={removed:false,f:{}};
    const rm=el('button',{class:'orig',type:'button',onclick:()=>{row.removed=!row.removed;c.classList.toggle('off',row.removed);rm.textContent=row.removed?'Put this line back':'This line is not on the paper'}},'This line is not on the paper');
    const sp=medline.split(m.as_written.text||m.as_written.a||m.as_written.b||'');
    const nf={...m.as_written,text:medline.split(m.as_written.text).name,a:m.as_written.a&&medline.split(m.as_written.a).name};
    const name=add(c,'Medicine',nf);row.name=name;
    row.f.as_written={get:()=>{const g=name.get();return{...g,value:g.value?(sp.prefix?sp.prefix+' ':'')+g.value:''}}};
    const form=medline.form(m.register,sp),gen=medline.generic(m.register);
    if(form)c.append(el('div',{class:'mute'},el('span',{},'Form'),': ',el('span',{},form),sp.prefix?' ('+sp.prefix+')':''));
    if(gen)c.append(labelled('Generic (DDA register)',gen,'reg'));
    const rl=regLine(m.register);if(rl)c.append(rl);else if(m.dda==='not_found')c.append(el('div',{class:'mute'},'Not found on the DDA register: kept as written.'));
    const dose=doseField(m.dose);c.append(dose.node);fields.push(dose);row.f.dose=dose;
    // how long: only when the paper says it (most prescriptions for long-term medicines do not)
    row.f.duration=m.duration&&m.duration.state!=='empty'?add(c,'How long (as written)',m.duration):{get:()=>({value:''})};
    if(m.as_written.byRegister)c.append(el('div',{class:'mute'},'The readers did not agree, but this copy is on the DDA register exactly. Check it against the paper.'));
    c.append(rm);meds.push(row)});
  const err=el('div',{class:'mute',style:'color:#a01212;margin-top:6px'});
  const go=el('button',{class:'go',type:'button'},'Add to my record');
  v.append(go,err,el('p',{class:'mute'},'Abhilekh keeps what the paper says. It gives no advice.'));
  go.onclick=async()=>{
    let missing=0;
    const live=f=>!rows.concat(meds).some(r=>r.removed&&(Object.values(r.f).includes(f)||r.name===f));
    for(const f of fields){const need=live(f)&&!f.done();f.mark(need);if(need)missing++}
    if(missing){err.textContent=missing+' line'+(missing>1?'s':'')+' still to check. They are marked in yellow.';const n=v.querySelector('.need');if(n)n.scrollIntoView({block:'center'});return}
    err.textContent='';go.disabled=true;
    const pack=row=>row.removed?{removed:true}:Object.fromEntries(Object.entries(row.f).map(([k,c])=>[k,c.get()]));
    try{REC=await post('/api/papers/'+p.id+'/confirm',{date:date.get(),facility:fac.get().value,clinician:doc.get().value,results:rows.map(pack),medicines:meds.map(pack)});
      paint();paintForm();tab('papers')}
    catch(e){err.textContent=e.message;go.disabled=false}
  };
}
const STATUS={confirmed:'Checked and added to your record',waiting:'Original kept · waiting to be read',reading:'Being read…',paused:'Waiting: the reading limit for this month is reached',failed:'Could not be read. The original is kept.',ready:'Read · ready to check'};
function paperCard(p){
  const card=el('div',{class:'card'});
  const img=el('img',{class:'crop',alt:'The original photo, as taken',loading:'lazy',src:'/api/papers/'+p.id+'/original'});
  img.onclick=()=>viewPhoto(p.id);img.style.cursor='zoom-in';
  card.append(el('div',{},el('span',{class:'chip'},'Photo')),img,
    el('div',{class:'t',style:'margin-top:6px'},STATUS[p.status]||p.status));
  if(p.status==='ready'&&p.reading){
    const s=p.reading.summary;
    card.append(el('div',{class:'mute'},s.agreed+' agreed by both readers · '+s.confirm+' for you to check · '+s.unresolved+' unresolved'));
    if(p.reading.oneReader)card.append(el('div',{class:'mute'},'Only one reader answered, so nothing is marked as agreed.'));
    const body=el('div',{style:'display:none'},readingView(p.reading));
    card.append(el('button',{class:'go',type:'button',onclick:()=>openCheck(p)},'Check and add to my record'));
    card.append(el('button',{class:'orig',type:'button',onclick:e=>{const o=body.style.display==='none';body.style.display=o?'':'none';e.target.textContent=o?'Hide what the readers found':'See what the readers found'}},'See what the readers found'),body);
  }
  card.append(el('div',{class:'mute'},'Added '+fmt(p.added)),el('div',{class:'mute'},Math.round(p.bytes/1024)+' KB'),
    el('div',{class:'mute',style:'font-size:12px;word-break:break-all'},'SHA-256 '+p.sha256));
  return card;
}
function paint(){
  paintPeople();
  $('tilePhoto').disabled=!REC.photos;$('tilePhotoSub').textContent=REC.photos?'Kept exactly as taken':'Coming soon';
  const n=REC.docs.length+(REC.papers||[]).length;
  $('homeTitle').textContent=REC.label?'Papers of '+REC.label.replace(/^papers of\s+/i,''):'Hello';
  $('labelBtn').textContent=REC.label?'Change name':'Add a name for this record';
  $('firstUse').style.display=n?'none':'';
  $('tileShow').disabled=!REC.docs.length;$('tileShowSub').textContent=REC.docs.length?'Choose papers, set the time':'Add a checked paper first';
  const hc=$('homeCards');hc.replaceChildren();
  if(n){
    const live=SH.filter(s=>s.state==='live').length;
    const ready=(REC.papers||[]).filter(p=>p.status==='ready').length;
    hc.append(el('button',{class:'card',style:'width:100%;text-align:left;font-weight:400;color:var(--ink)',onclick:()=>tab('papers')},el('b',{},n+' paper'+(n>1?'s':'')),el('div',{class:'mute'},ready?ready+' ready to check':'Tap to see them')));
    hc.append(el('button',{class:'card',style:'width:100%;text-align:left;font-weight:400;color:var(--ink)',onclick:()=>tab('share')},el('b',{},live?live+' active share'+(live>1?'s':''):'Nothing is being shared'),el('div',{class:'mute'},live?'Tap to see who looked':'Only you can see your papers')));
  }
  const pl=$('papers');pl.replaceChildren();
  if(!n)pl.append(el('div',{class:'card mute'},'No papers yet. Photograph a paper from Home.'));
  for(const p of REC.papers||[])if(p.status!=='confirmed')pl.append(paperCard(p));
  for(const d of REC.docs){
    const card=el('div',{class:'card'});
    const body=el('div',{style:'display:none'},resultRows(d));
    card.append(el('div',{},d.origin==='sample'?el('span',{class:'chip'},'SAMPLE'):el('span',{class:'chip'},'Checked by you')),el('div',{class:'t',style:'margin-top:6px'},d.title),el('div',{class:'mute'},d.facility+' · '+d.date),
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
  mins.forEach(m=>{const o=el('option',{value:m},LABEL[m]);if(m===15)o.selected=true;$('dur').append(o)});
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
pinpad('switch',['switchPin'],['Your PIN, to open these papers'],p=>{$('switchGo').click();autoReset(p)},{hide:['switchGo']});
pinpad('change',['oldPin','newPin1','newPin2'],['Your current PIN','Choose a new 6-digit PIN','Type the new PIN again'],p=>{
  if($('newPin1').value!==$('newPin2').value){$('newPin1').value=$('newPin2').value='';p.goto(1);p.error('The two new PINs are not the same. Type the new PIN again.');return}
  $('pinChange').click();autoReset(p,1200)},{hide:['pinChange']});
