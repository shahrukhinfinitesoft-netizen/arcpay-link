import { discover } from './sources.js';
import { POLICY, scoreOpportunity } from './score.js';

export async function scan(options={}) {
  const now=options.now ?? Date.now(), result=await discover({...options,now});
  const listings=result.listings.map(x=>scoreOpportunity(x,now)).sort((a,b)=>b.score-a.score);
  const shortlist=listings.filter(x=>x.decision==='REVIEW');
  return {version:'1.0.0',scannedAt:new Date(now).toISOString(),
    status:result.sources.some(x=>x.status==='error')?'degraded':'ok',
    policy:POLICY,sources:result.sources,listings,
    summary:{scanned:listings.length,shortlisted:shortlist.length,rejected:listings.filter(x=>x.decision==='REJECT').length,
      agentEligible:listings.filter(x=>['AGENT_ALLOWED','AGENT_ONLY'].includes(x.agentAccess)).length,
      recommendation:shortlist.length?'Review the top candidate and verify all requirements before producing work.':'No suitable opportunity found in this scan. Do not manufacture a submission.'},
    limitations:['Scores and work-hour estimates are heuristics, not probabilities of winning.','Rewards are conditional; a listing or escrow reference is not proof of payout.','V1 discovers and scores. Submission work is prepared in a human-reviewed session; no unattended LLM or automatic entry is enabled.','Latest results use an ephemeral regional cache; cache loss triggers a fresh scan.'],
  };
}
