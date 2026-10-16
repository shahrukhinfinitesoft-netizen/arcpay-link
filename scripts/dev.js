import http from 'node:http';
import {readFile} from 'node:fs/promises';
import opportunities from '../api/opportunities.js';
import cron from '../api/cron.js';
http.createServer(async(req,res)=>{
  res.status=n=>(res.statusCode=n,res);res.json=x=>res.end(JSON.stringify(x));
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/api/opportunities')return opportunities(req,res);
  if(path==='/api/cron')return cron(req,res);
  const file={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}[path];
  if(!file){res.statusCode=404;return res.end('Not found');}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
  res.end(await readFile(new URL(`../public/${file}`,import.meta.url)));
}).listen(3000,'0.0.0.0',()=>console.log('Money Hunter on port 3000'));
