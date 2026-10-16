import { timingSafeEqual } from 'node:crypto';
import { scan } from '../lib/scan.js';
import { saveLatest } from '../lib/store.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  const expected=process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  const actual=req.headers.authorization || '';
  if(!expected || actual.length!==expected.length || !timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return res.status(401).json({error:'Unauthorized'});
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  if(!process.env.SUPERTEAM_API_KEY)return res.status(503).json({error:'Agent key missing'});
  try {
    const result=await scan();await saveLatest(result);
    return res.status(result.status==='ok'?200:207).json({status:result.status,scannedAt:result.scannedAt,summary:result.summary});
  }catch{return res.status(502).json({error:'Scan failed'});}
}
