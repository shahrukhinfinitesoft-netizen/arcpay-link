import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverPayment,findStartBlock,NATIVE_USDC_EMITTER,TRANSFER_TOPIC,type ChainReader} from '../lib/chain-payment.ts';
import {amountToWei,type Invoice} from '../lib/payment.ts';
const hash='0x'+'a'.repeat(64),other='0x'+'c'.repeat(64),blockHash='0x'+'b'.repeat(64);
const invoice:Invoice={id:'request',recipient:'0x'+'1'.repeat(40),amount:'1',note:'',createdAt:1000000,data:'0x1234',txHash:null,payer:null,blockNumber:null,paidAt:null,fee:null};
const tx={hash,from:'0x'+'2'.repeat(40),to:invoice.recipient,value:'0x'+amountToWei('1').toString(16),input:invoice.data,blockHash,blockNumber:'0x10',chainId:'0x13b2'};
const receipt={status:'0x1',transactionHash:hash,from:tx.from,to:tx.to,blockHash,blockNumber:'0x10',gasUsed:'0x5208',effectiveGasPrice:'0x1'};
const log=(h=hash)=>({address:NATIVE_USDC_EMITTER,topics:[TRANSFER_TOPIC,'0x'+tx.from.slice(2).padStart(64,'0'),'0x'+invoice.recipient.slice(2).padStart(64,'0')],data:tx.value,transactionHash:h});
function reader(logs:unknown[],status='0x1',missing=false):ChainReader{return (async(method:string,params:unknown[]=[])=>{
 if(method==='eth_getLogs')return logs;
 if(method==='eth_getTransactionByHash')return params[0]===other?{...tx,hash:other,input:'0xother'}:tx;
 if(method==='eth_getTransactionReceipt')return missing?null:{...receipt,status};
 if(method==='eth_getBlockByNumber')return {hash:blockHash,timestamp:'0x3e8'};
 throw new Error(method);
}) as ChainReader;}
test('discovers exact invoice without a browser-returned hash and ignores same-amount unrelated payments',async()=>{const r=await discoverPayment(invoice,1n,20n,reader([log(other),log()]));assert.equal(r.payment?.txHash,hash);assert.equal(r.payment?.payer,tx.from);});
test('removed logs never settle an invoice',async()=>{const r=await discoverPayment(invoice,1n,20n,reader([{...log(),removed:true}]));assert.equal(r.payment,null);});
test('failed or unavailable receipt cannot advance a matching payment scan',async()=>{await assert.rejects(discoverPayment(invoice,1n,20n,reader([log()],'0x0')));await assert.rejects(discoverPayment(invoice,1n,20n,reader([log()],'0x1',true)));});
test('bounds scans to 1000 blocks and signals catch-up',async()=>{let filter:any;const read=(async(m:string,p:unknown[])=>{filter=p[0];return [];}) as ChainReader;const r=await discoverPayment(invoice,10n,5000n,read);assert.equal(filter.toBlock,'0x3f1');assert.equal(r.scannedThrough,1009n);assert.equal(r.catchingUp,true);});
test('legacy creation search returns earliest block at timestamp boundary',async()=>{const read=(async(m:string,p:unknown[])=>({timestamp:'0x'+(Number(BigInt(p[0] as string))/2|0).toString(16)})) as ChainReader;assert.equal(await findStartBlock(130000,100n,read),20n);});
