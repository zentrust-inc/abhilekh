// One medicine line, split for showing (decided 25 Nov 2026): the form word the doctor wrote in front ("T.", "Tab", "Cap",
// "Inj", "Syp" ...) is shown as the form, the rest as the medicine, and the generic comes only from the DDA register on an
// exact name match. The line as written is kept whole in the record; this only changes how it is shown.
(function(){
const FORMS=[[/^(t|tab|tabs|tablet|tablets)$/i,'Tablet'],[/^(c|cap|caps|capsule|capsules)$/i,'Capsule'],[/^(inj|injection)$/i,'Injection'],
  [/^(syp|syr|syrup)$/i,'Syrup'],[/^(susp|suspension)$/i,'Suspension'],[/^(oint|ointment)$/i,'Ointment'],[/^(gtt|drop|drops)$/i,'Drops'],[/^(sachet|sach)$/i,'Sachet']];
// "T. Neva 5 mg" -> { prefix:"T.", form:"Tablet", name:"Neva 5 mg" }
function split(text){
  const s=String(text||'').trim(),m=s.match(/^([A-Za-z]+)\.?\s+(.+)$/);
  if(m){for(const [re,form] of FORMS){if(re.test(m[1]))return{prefix:s.slice(0,s.length-m[2].length).trim(),form,name:m[2].trim()}}}
  return{prefix:'',form:'',name:s};
}
const cap=g=>String(g).toLowerCase().replace(/^./,c=>c.toUpperCase());
// the generic from an exact register match: "Nebivolol hydrochloride 5 mg"; none when the name is shared by different medicines
function generic(reg){
  if(!reg||reg.mixed||!reg.products||!reg.products.length)return '';
  const p=reg.products[0];
  return p.generics.map(cap).join(' + ')+(reg.strengthMatched&&p.strength?' '+p.strength:'');
}
// form from the register when it matched exactly, otherwise from the form word on the paper
function form(reg,sp){
  const p=reg&&!reg.mixed&&reg.products&&reg.products[0];
  return p&&p.form?cap(p.form):sp.form;
}
// How often: the usual ways it is written on Nepali prescriptions, shown exactly as written. "Other" takes anything else.
const DOSES=['OD','BD','TDS','QID','HS','SOS','STAT','1-0-0','0-1-0','0-0-1','1-0-1','1-1-0','0-1-1','1-1-1','Once a week'];
const doseOption=t=>{const k=String(t||'').replace(/\s+/g,'').toLowerCase();return DOSES.find(d=>d.replace(/\s+/g,'').toLowerCase()===k)||''};
window.medline={split,generic,form,DOSES,doseOption};
})();
