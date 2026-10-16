import { plain } from './score.js';

const ST = 'https://superteam.fun';
export async function readJSON(url, { key, fetcher = fetch } = {}) {
  const response = await fetcher(url, { headers: { Accept:'application/json', ...(key ? {Authorization:`Bearer ${key}`} : {}) }, signal:AbortSignal.timeout(12000), redirect:'error' });
  if (!response.ok) throw new Error(`HTTP ${response.status}${response.status === 429 ? ' (rate limited; wait before retrying)' : ''}`);
  return response.json();
}
export function rows(data) {
  if (Array.isArray(data)) return data;
  for (const key of ['listings','tasks','jobs','data']) if (Array.isArray(data?.[key])) return data[key];
  throw new Error('Unexpected feed shape; results cannot be trusted.');
}
function prize(rewards) {
  if (!rewards || typeof rewards !== 'object') return null;
  const amounts = Object.values(rewards).map(Number).filter(x=>Number.isFinite(x)&&x>0);
  return amounts.length ? Math.max(...amounts) : null;
}
export function superteamItem(x, detailComplete = false) {
  return { id:x.id, source:'Superteam Earn', title:plain(x.title), description:plain(x.description || x.content || ''),
    url:`${ST}/earn/listing/${encodeURIComponent(x.slug)}/`, slug:x.slug,
    agentAccess:x.agentAccess, status:x.status, deadline:x.deadline,
    token:x.token, poolReward:Number(x.rewardAmount)||null, individualReward:prize(x.rewards),
    competition:Number.isFinite(x._count?.Submission) ? x._count.Submission : null,
    skills:Array.isArray(x.skills) ? x.skills.map(s=>typeof s==='string'?s:JSON.stringify(s)) : [],
    winnersAnnounced:!!x.isWinnersAnnounced, requiredSpend:0, costKnown:false,
    detailComplete, eligibilityVerified:false, listingType:x.type,
  };
}
export function taskmarketItem(x) {
  const fees = (x.pendingActions || []).filter(a=>a.role==='worker' && ['claim','submit','pitch','bid','submit_proof','auction_accept'].includes(a.action) && a.requiresPayment).map(a=>Number(a.paymentAmount)/1e6);
  const paidMode = ['pitch','benchmark','auction'].includes(x.mode);
  return { id:x.id, source:'Taskmarket', title:plain(x.description.split('\n')[0]).replace(/^#+\s*/,''), description:plain(x.description),
    url:`https://taskmarket.dev/tasks/${encodeURIComponent(x.id)}`, agentAccess:'AGENT_ALLOWED', status:x.status==='open'?'OPEN':x.status,
    deadline:x.expiryTime, token:'USDC', poolReward:Number(x.reward)/1e6,
    individualReward:Number(x.netReward ?? x.reward)/1e6, competition:x.submissionCount ?? null, skills:x.tags || [],
    requiredSpend:x.stakeRequired ? Math.max(.001,Number(x.reward)/1e6*(x.stakeBps||10000)/10000) : fees.length ? Math.max(...fees) : paidMode ? .001 : 0,
    costKnown:!paidMode && !x.stakeRequired && fees.length===0,
    detailComplete:true, eligibilityVerified:false, fundingEvidence:x.escrowTxHash ? 'Escrow transaction reported by platform; not independently verified.' : 'Unverified funding.',
  };
}
export function moltItem(x) {
  return {id:x.id,source:'MoltJobs',title:plain(x.title),description:plain(x.inputData?.generalDescription || ''),
    url:`https://moltjobs.io/jobs/${encodeURIComponent(x.id)}`,agentAccess:'AGENT_ALLOWED',status:x.status,
    deadline:x.deadlineAt,token:'USDC',poolReward:Number(x.budgetUsdc),individualReward:Number(x.budgetUsdc)*.95,
    competition:null,skills:x.requiredSkills || [],requiredSpend:0,costKnown:false,detailComplete:false,eligibilityVerified:false,
    fundingEvidence:x.funded ? 'Platform reports funded; verify escrow before entry.' : 'Unverified funding.'};
}

export async function discover({ key = process.env.SUPERTEAM_API_KEY, fetcher = fetch, now = Date.now() } = {}) {
  const sources = [], listings = [];
  const run = async (name, action) => {
    try { const data = await action(); sources.push({name,status:'ok',...data}); }
    catch { sources.push({name,status:'error',message:'Source could not be verified. This is not an empty feed.'}); }
  };
  await Promise.all([
    run('Superteam agents',async()=>{
      if (!key) throw new Error('Missing SUPERTEAM_API_KEY');
      let skip=0,count=0,full=false; const seen=new Set();
      for(let page=0;page<5;page++) {
        const a=rows(await readJSON(`${ST}/api/agents/listings/live?take=50&skip=${skip}&deadline=${encodeURIComponent(new Date(now).toISOString())}`,{key,fetcher}));
        const fresh=a.filter(x=>!seen.has(x.id)); fresh.forEach(x=>seen.add(x.id));
        listings.push(...fresh.map(x=>({...superteamItem(x),authenticatedFeed:true}))); count+=fresh.length;
        if(a.length<50) {full=true;break;} if(!fresh.length)break;skip+=50;
      }
      return {count,coverage:full?'complete returned feed':'bounded scan; pagination may be incomplete'};
    }),
    run('Superteam public cross-check',async()=>{
      const a=rows(await readJSON(`${ST}/api/listings?take=100`,{fetcher}));
      listings.push(...a.map(x=>superteamItem(x)));
      return {count:a.length,coverage:'First 100 public listings; hidden agent-only work requires the agent feed.'};
    }),
    run('TaskBounty',async()=>{
      const d=await readJSON('https://www.task-bounty.com/api/v1/tasks',{fetcher}),a=rows(d);
      for(const x of a) listings.push({id:x.id,source:'TaskBounty',title:plain(x.title),description:plain(x.description),url:'https://www.task-bounty.com/browse',agentAccess:'AGENT_ALLOWED',status:x.status==='open'?'OPEN':x.status,deadline:x.deadline ?? null,token:'USD',poolReward:Number(x.bounty_cents)/100,individualReward:Number(x.bounty_cents)*.8/100,competition:null,skills:[x.language].filter(Boolean),requiredSpend:0,costKnown:false,detailComplete:false,eligibilityVerified:false});
      return {count:a.length,coverage:'Current public task feed; payout eligibility must be confirmed before work.'};
    }),
    run('Taskmarket',async()=>{
      let cursor='',count=0,full=false;
      for(let page=0;page<3;page++) {
        const d=await readJSON(`https://api.taskmarket.dev/api/tasks?status=open&limit=100&sort=reward_desc${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`,{fetcher}),a=rows(d);
        listings.push(...a.map(taskmarketItem));count+=a.length;
        if(!d.hasMore){full=true;break;}if(!d.nextCursor)break;cursor=d.nextCursor;
      }
      return {count,coverage:full?'complete returned feed':'bounded scan; additional pages not scanned'};
    }),
    run('MoltJobs',async()=>{
      const d=await readJSON('https://api.moltjobs.io/v1/jobs?status=OPEN&limit=100',{fetcher}),a=rows(d);
      listings.push(...a.map(moltItem));
      return {count:a.length,coverage:d.meta?.hasMore?'First page only; more results exist.':'complete returned feed'};
    }),
  ]);
  // Prefer the authenticated feed when a listing appears in both feeds.
  const unique=new Map();for(const x of listings)if(!unique.has(`${x.source}:${x.id}`)||x.authenticatedFeed)unique.set(`${x.source}:${x.id}`,x);
  const result=[...unique.values()];
  // Enrich only plausible agent-eligible entries. Never fetch other entrants' submissions.
  const candidates=result.filter(x=>x.source==='Superteam Earn'&&['AGENT_ALLOWED','AGENT_ONLY'].includes(x.agentAccess)).slice(0,6);
  await Promise.all(candidates.map(async x=>{
    try {
      const d=await readJSON(`${ST}/api/agents/listings/details/${encodeURIComponent(x.slug)}`,{key,fetcher});
      const detail=d.listing || d.data || d;
      if(detail.id!==x.id)throw new Error('Detail mismatch');
      Object.assign(x,superteamItem({...detail,_count:detail._count || {Submission:x.competition}},true));
    }catch{x.detailComplete=false;}
  }));
  return {sources,listings:result};
}
