import {writeFile} from 'node:fs/promises';
import { scan } from '../lib/scan.js';
const data=await scan();
await writeFile('reports/latest.json',JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({scannedAt:data.scannedAt,status:data.status,summary:data.summary,sources:data.sources},null,2));
