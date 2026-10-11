import { amountToWei, CHAIN_HEX, type Invoice } from '../lib/payment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectAccount, isMobileBrowser, metaMaskDappLink, submitInvoicePayment } from '../lib/wallet.ts';

test('mobile dapp link preserves the exact payment URL and opens no signing request', () => {
  const target = 'https://arcpay-link.faircalf64.chatgpt.site/?pay=abc-123';
  assert.equal(metaMaskDappLink(target), 'https://metamask.app.link/dapp/arcpay-link.faircalf64.chatgpt.site/?pay=abc-123');
  assert.equal(metaMaskDappLink('https://example.com/pay?a=1&b=2#receipt'), 'https://metamask.app.link/dapp/example.com/pay?a=1&b=2#receipt');
  assert.throws(() => metaMaskDappLink('http://example.com'));
  assert.throws(() => metaMaskDappLink('https://user:password@example.com'));
});
test('detects phone and iPad desktop user agents without affecting desktop extensions', () => {
  assert.equal(isMobileBrowser('Android'), true);
  assert.equal(isMobileBrowser('iPhone'), true);
  assert.equal(isMobileBrowser('Macintosh', 5), true);
  assert.equal(isMobileBrowser('Macintosh', 0), false);
  assert.equal(isMobileBrowser('Windows NT'), false);
});
test('existing wallet access does not request additional permission', async () => {
  const calls: string[] = [];
  const account = await connectAccount({request: async ({method}) => { calls.push(method); return ['0x123']; }});
  assert.equal(account, '0x123');
  assert.deepEqual(calls, ['eth_accounts']);
});
test('first connection requests only accounts, no signatures or spending permission', async () => {
  const calls: string[] = [];
  await connectAccount({request: async ({method}) => { calls.push(method); return method === 'eth_accounts' ? [] : ['0x123']; }});
  assert.deepEqual(calls, ['eth_accounts', 'eth_requestAccounts']);
});

const payer='0x'+'2'.repeat(40),recipient='0x'+'1'.repeat(40),hash='0x'+'a'.repeat(64);
const invoice:Invoice={id:'pay-flow',recipient,amount:'0.1',note:'Test',createdAt:0,data:'0x41524350415901',txHash:null,payer:null,blockNumber:null,paidAt:null,fee:null};
const transaction={from:payer,to:recipient,value:'0x'+amountToWei(invoice.amount).toString(16),data:invoice.data,gas:'0x6000',gasPrice:'0x4a817c800'};
function walletMock(options:{reject?:boolean;changed?:boolean;wrongChain?:boolean}={}){
  const calls:string[]=[];
  let accountReads=0,chainReads=0;
  const provider={request:async({method,params}:{method:string;params?:unknown[]})=>{
    calls.push(method);
    if(method==='eth_accounts')return [options.changed && ++accountReads>1?recipient:payer];
    if(method==='eth_chainId')return options.wrongChain && ++chainReads>1?'0x1':CHAIN_HEX;
    if(method==='eth_sendTransaction'){
      if(options.reject)throw Object.assign(new Error('User rejected'),{code:4001});
      assert.deepEqual(params,[{...transaction,chainId:CHAIN_HEX}]);return hash;
    }
    throw new Error('Unexpected permission or signing method: '+method);
  }};
  return {provider,calls};
}
test('single Pay action prepares the exact invoice and requests one wallet-approved transaction',async()=>{
  const {provider,calls}=walletMock();let prepared=false,reviewed=false;
  const result=await submitInvoicePayment(provider,invoice,{
    getInvoice:async()=>invoice,
    prepare:async account=>{assert.equal(account,payer);prepared=true;return transaction;},
    onReview:()=>{assert.equal(prepared,true);reviewed=true;},
  });
  assert.deepEqual(result,{hash});assert.equal(reviewed,true);
  assert.equal(calls.filter(x=>x==='eth_sendTransaction').length,1);
  assert.equal(invoice.txHash,null); // Wallet return alone never marks a receipt paid.
});
test('wallet rejection never produces a hash or retries a transaction',async()=>{
  const {provider,calls}=walletMock({reject:true});
  await assert.rejects(submitInvoicePayment(provider,invoice,{getInvoice:async()=>invoice,prepare:async()=>transaction}),/User rejected/);
  assert.equal(calls.filter(x=>x==='eth_sendTransaction').length,1);
});
test('changed account or chain aborts before requesting transaction approval',async()=>{
  for(const option of [{changed:true},{wrongChain:true}]){
    const {provider,calls}=walletMock(option);
    await assert.rejects(submitInvoicePayment(provider,invoice,{getInvoice:async()=>invoice,prepare:async()=>transaction}),/account or network changed/);
    assert.equal(calls.includes('eth_sendTransaction'),false);
  }
});
test('changed recipient, amount or reference aborts before signing',async()=>{
  for(const changed of [{to:payer},{value:'0x1'},{data:'0xdead'}]){
    const {provider,calls}=walletMock();
    await assert.rejects(submitInvoicePayment(provider,invoice,{getInvoice:async()=>invoice,prepare:async()=>({...transaction,...changed})}),/Payment details changed/);
    assert.equal(calls.includes('eth_sendTransaction'),false);
  }
});
test('a link paid during wallet connection is returned without another payment',async()=>{
  const {provider,calls}=walletMock();
  const paidInvoice={...invoice,txHash:hash};
  assert.deepEqual(await submitInvoicePayment(provider,invoice,{getInvoice:async()=>paidInvoice,prepare:async()=>{throw new Error('Must not prepare a paid invoice');}}),{invoice:paidInvoice});
  assert.equal(calls.includes('eth_sendTransaction'),false);
});
