const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const money=x=>x==null?'Individual prize unconfirmed':`Up to $${Number(x).toLocaleString(undefined,{maximumFractionDigits:2})}`;
function safeLink(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function card(x){
  const root=el('article',undefined,'card');
  root.append(el('span',`${x.score}/100`,'score'),el('span',x.decision==='REVIEW'?'REVIEW REQUIRED':x.decision,'badge'+(x.decision==='REJECT'?' reject':'')));
  const h=el('h3'),url=safeLink(x.url);
  if(url){const a=el('a',x.title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';h.append(a);}else h.textContent=x.title;
  root.append(h,el('p',`${x.source} · ${money(x.individualReward)} ${x.token||''} · ${x.competition??'Unknown'} entries`,'meta'));
  root.append(el('p',`${x.hoursLeft===null?'Deadline unconfirmed':`${x.hoursLeft}h left`} · ~${x.estimatedWorkHours}h estimated work · ${x.agentAccess||'ACCESS UNKNOWN'}`,'meta'));
  const list=el('ul');for(const s of x.reasons)list.append(el('li',s));root.append(list);
  const d=el('details'),s=el('summary','Score & checks');d.append(s);
  const dims=el('div',undefined,'dimensions');for(const [name,points] of Object.entries(x.dimensions)){dims.append(el('span',name.replace(/([A-Z])/g,' $1')),el('span',String(points)));}d.append(dims);
  const checks=el('ul');for(const c of x.checks)checks.append(el('li',c));d.append(checks,el('p',`Submission strength: ${x.submissionStrength}. Win probability is unknown.`,'hint'));root.append(d);return root;
}
async function refresh(){
  $('refresh').disabled=true;
  try{
    const response=await fetch('/api/opportunities',{cache:'no-store'}),data=await response.json();
    if(!response.ok)throw new Error(data.error||'Scan unavailable');
    $('checked').textContent=data.summary.scanned;$('shortlisted').textContent=data.summary.shortlisted;
    $('headline').textContent=data.summary.shortlisted?'A candidate is ready for review.':'No suitable work in this scan.';
    $('recommendation').textContent=data.summary.recommendation+(data.status==='degraded'?' Some sources failed; coverage is incomplete.':'');
    $('timestamp').textContent=`Last scan: ${new Date(data.scannedAt).toLocaleString('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'})} PKT · no automatic submissions`;
    const shortlist=data.listings.filter(x=>x.decision==='REVIEW');$('opportunities').replaceChildren();
    if(!shortlist.length){const empty=el('div',undefined,'empty');empty.append(el('strong','Your time stays yours.'),el('p','The current listings failed the requirements. Check the rejected list to see exactly why.'));$('opportunities').append(empty);}else shortlist.forEach(x=>$('opportunities').append(card(x)));
    const rejected=data.listings.filter(x=>x.decision!=='REVIEW');$('rejected-count').textContent=`(${rejected.length})`;$('rejected').replaceChildren(...rejected.map(card));
    $('health').textContent=data.status==='ok'?'SOURCES CHECKED':'PARTIAL COVERAGE';
    $('sources').replaceChildren(...data.sources.map(x=>{const r=el('div',undefined,'source'),a=el('div',x.name);a.append(el('small',x.coverage||x.message));r.append(a,el('span',x.status==='ok'?`${x.count} RETURNED`:'UNAVAILABLE','status'+(x.status==='error'?' error':'')));return r;}));
  }catch(e){$('headline').textContent='Setup or connection needs attention.';$('recommendation').textContent=e.message;$('health').textContent='UNAVAILABLE';}
  finally{$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',refresh);refresh();
