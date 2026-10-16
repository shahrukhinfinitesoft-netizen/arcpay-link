import { scan } from '../lib/scan.js';
import { loadLatest,saveLatest } from '../lib/store.js';
let pending;
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Read-only endpoint.'});
  if(!process.env.SUPERTEAM_API_KEY)return res.status(503).json({error:'Setup required: SUPERTEAM_API_KEY is not configured on the server.'});
  try {
    let data=await loadLatest();
    if(!data || Date.now()-Date.parse(data.scannedAt)>3600000) {
      if(!pending)pending=scan().then(async value=>{await saveLatest(value);return value;}).finally(()=>{pending=undefined;});
      data=await pending;
    }
    return res.status(200).json(data);
  }catch{return res.status(502).json({error:'Scan unavailable. No entries or payments were made.'});}
}
