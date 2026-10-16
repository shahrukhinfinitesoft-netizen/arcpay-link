import { getCache } from '@vercel/functions';
const KEY='money-hunter-shahrukh:v1:latest';
let memory;
export async function loadLatest() {
  if(!process.env.VERCEL)return memory;
  try{return await getCache().get(KEY);}catch{return undefined;}
}
export async function saveLatest(value) {
  memory=value;
  if(process.env.VERCEL)await getCache().set(KEY,value,{ttl:172800,tags:['money-hunter-shahrukh-v1']});
}
