export const POLICY = Object.freeze({
  minimumReward: 25, maximumCompetition: 30, minimumHoursLeft: 24,
  maximumWorkHours: 12, minimumHourlyReward: 5, shortlistScore: 70,
  spendingLimit: 0, automaticSubmissions: false,
});

export function plain(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function scoreOpportunity(item, now = Date.now()) {
  const text = plain(`${item.title} ${item.description} ${(item.skills || []).join(' ')}`).toLowerCase();
  const reasons = [], checks = [];
  const hoursLeft = item.deadline ? (Date.parse(item.deadline) - now) / 3600000 : null;
  const reward = item.individualReward;
  const advanced = /\b(cuda|zero.knowledge|zk.proof|formal verification|smart.contract audit|cryptograph|solana validator|rust protocol|kernel driver)\b/i.test(text);
  const code = /\b(code|coding|typescript|javascript|python|api|implement|integration|build|game)\b/.test(text);
  const research = /\b(research|documentation|write|writing|article|analysis|analyse|feedback|testing|test)\b/.test(text);
  const workHours = advanced ? 40 : code ? 10 : research ? 4 : 8;
  const relevantSkills = research || code;
  if (!['AGENT_ALLOWED', 'AGENT_ONLY'].includes(item.agentAccess)) reasons.push('Agent submissions are not explicitly permitted.');
  if (item.status !== 'OPEN' || item.winnersAnnounced) reasons.push('Not open for new entries.');
  if (hoursLeft !== null && (!Number.isFinite(hoursLeft) || hoursLeft < POLICY.minimumHoursLeft)) reasons.push('Less than 24 hours remain, or deadline is invalid.');
  if (hoursLeft === null) checks.push('Confirm the actual deadline.');
  if (reward === null || reward === undefined || !Number.isFinite(reward)) checks.push('Confirm the individual prize; a total pool is not your payout.');
  else if (reward < POLICY.minimumReward) reasons.push(`Individual reward is below $${POLICY.minimumReward}.`);
  if (!['USDC', 'USDG', 'USD', 'USDT'].includes(item.token)) reasons.push('Reward is not a supported dollar/stablecoin amount; value is unverified.');
  if (Number(item.requiredSpend) > 0) reasons.push('Entry requires spending, staking, a deposit or a paid action.');
  if (item.costKnown !== true) checks.push('Confirm entry and tool costs are zero.');
  if (item.competition !== null && item.competition > POLICY.maximumCompetition) reasons.push('More than 30 entries already compete for the reward.');
  if (item.competition === null) checks.push('Competition count is unavailable.');
  if (advanced || workHours > POLICY.maximumWorkHours) reasons.push('Requires specialist infrastructure or skills beyond this V1.');
  if (/\b(cold (?:call|email)|recruit (?:users|friends)|bring (?:an agent|your friends)|referral bounty|find clients|direct outreach)\b/.test(text)) reasons.push('Requires outreach or referrals.');
  if (/\b(must attend|in.person attendance|requires? (?:a |an )?(?:gpu|seeker device|macbook)|mainnet (?:deposit|trading)|trading competition)\b/.test(text)) reasons.push('Requires hardware, attendance or financial activity outside this setup.');
  if (reward != null && reward / workHours < POLICY.minimumHourlyReward) reasons.push('Face-value reward per estimated work hour is too low, even before competition.');
  if (item.detailComplete !== true) checks.push('Read the complete brief and eligibility questions before preparing work.');
  if (!relevantSkills) checks.push('Required skills need manual verification.');
  if (item.eligibilityVerified !== true) checks.push('Verify Pakistan eligibility, payout route, account requirements and content rights.');
  if (/\b(publish|post on x|twitter|medium|dev.to|farcaster|bluesky)\b/.test(text)) checks.push('Publishing requires an authorized human account and approval.');
  const dimensions = {
    reward: reward == null ? 0 : Math.min(15, Math.round(5 * Math.log2(1 + reward / 25))),
    difficulty: advanced ? 0 : code ? 7 : research ? 15 : 5,
    deadline: hoursLeft === null ? 2 : hoursLeft >= 72 ? 10 : hoursLeft >= 24 ? 5 : 0,
    competition: item.competition === null ? 3 : item.competition <= 5 ? 15 : item.competition <= 15 ? 10 : item.competition <= 30 ? 5 : 0,
    skills: advanced ? 0 : relevantSkills ? 15 : 4,
    tools: advanced ? 0 : item.requiredSpend > 0 ? 0 : 12,
    strongSubmission: advanced ? 0 : item.detailComplete && research ? 13 : item.detailComplete && code ? 9 : 3,
  };
  const score = Object.values(dimensions).reduce((a,b) => a+b,0);
  const decision = reasons.length ? 'REJECT' : score >= POLICY.shortlistScore ? 'REVIEW' : 'HOLD';
  return { ...item, score, dimensions, decision, reasons, checks,
    estimatedWorkHours: workHours, hoursLeft: Number.isFinite(hoursLeft) ? Math.round(hoursLeft) : null,
    submissionStrength: advanced ? 'weak' : research && item.detailComplete ? 'potentially strong' : 'unverified',
    winProbability: null,
    recommendation: reasons.length ? 'Skip this opportunity.' : 'Candidate only: verify every check before doing or submitting work.',
  };
}
