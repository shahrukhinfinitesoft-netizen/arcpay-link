'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowUpRight, ArrowRight, Check, CheckCheck, Copy, Link2, Wallet, ShieldCheck, ExternalLink, LoaderCircle, QrCode, ReceiptText } from 'lucide-react';
import { CHAIN_HEX, EXPLORER, formatWei, short, type Invoice } from '@/lib/payment';

import { connectAccount, isMobileBrowser, metaMaskDappLink, submitInvoicePayment, type WalletProvider as Provider } from '@/lib/wallet';
import { getMetaMaskClient } from '@/lib/metamask-client';
declare global {interface Window {ethereum?:Provider}}
async function api(path:string,body?:unknown) {
  const response=await fetch(path,body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {cache:'no-store'});
  const result=await response.json() as {invoice:Invoice;transaction:Record<string,string>;maxFee:string;pending?:boolean;checking?:boolean;syncError?:boolean;error?:string};
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}
const errorText=(e:unknown)=>e instanceof Error ? e.message : 'The wallet request was cancelled or could not be completed.';
function safeStore(key:string,value?:string) {try {if(value===undefined)return localStorage.getItem(key);localStorage.setItem(key,value);}catch{} return null;}
function clearStored(key:string){try{localStorage.removeItem(key);}catch{}}

export default function Home() {
  const [account,setAccount]=useState('');
  const [mobileLink,setMobileLink]=useState('');
  const [amount,setAmount]=useState('');
  const [note,setNote]=useState('');
  const [invoice,setInvoice]=useState<Invoice|null>(null);
  const [id,setId]=useState('');
  const [owner,setOwner]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [info,setInfo]=useState('');
  const [copied,setCopied]=useState(false);
  const [qr,setQr]=useState('');
  const [pending,setPending]=useState('');
  const [recover,setRecover]=useState('');
  const [checking,setChecking]=useState(true);
  const [syncError,setSyncError]=useState(false);
  const paying=useRef(false);
  const paymentUrl=typeof window!=='undefined' && id ? `${window.location.origin}/?pay=${id}` : '';

  useEffect(()=>{
    let active=true;
    let provider:Provider|undefined;
    const onChange=(v:unknown)=>{setAccount((v as string[])[0]||'');};
    const refreshMobileLink=()=>{
      setMobileLink(!window.ethereum && isMobileBrowser(navigator.userAgent,navigator.maxTouchPoints) ? metaMaskDappLink(window.location.href) : '');
      if(window.ethereum && provider!==window.ethereum){
        provider?.removeListener?.('accountsChanged',onChange);
        provider=window.ethereum;
        provider.on?.('accountsChanged',onChange);
        // Reuse existing access without displaying a permission popup on page load.
        void provider.request({method:'eth_accounts'}).then(v=>{if(active)setAccount((v as string[])[0]||'');}).catch(()=>{});
      }
    };
    refreshMobileLink();
    window.addEventListener('ethereum#initialized',refreshMobileLink);
    const current=new URLSearchParams(window.location.search).get('pay') || '';
    if(current) {if(!window.ethereum)void getMetaMaskClient().catch(()=>{});setId(current);setPending(safeStore('arcpay-pending-'+current)||'');api('/api/invoices/'+encodeURIComponent(current)).then(r=>{setInvoice(r.invoice);setChecking(!!r.checking);setSyncError(!!r.syncError);}).catch(e=>setError(errorText(e))).finally(()=>setLoading(false));}
    else setLoading(false);
    return()=>{active=false;window.removeEventListener('ethereum#initialized',refreshMobileLink);provider?.removeListener?.('accountsChanged',onChange);};
  },[]);
  useEffect(()=>{if(paymentUrl) QRCode.toDataURL(paymentUrl,{width:260,margin:2,color:{dark:'#192d25',light:'#ffffff'},errorCorrectionLevel:'M'}).then(setQr).catch(()=>setError('QR code could not be generated. You can still copy the link.'));},[paymentUrl]);
  const verify=useCallback(async(hash:string)=>{
    const result=await api(`/api/invoices/${id}/verify`,{hash});
    if(result.invoice){setInvoice(result.invoice);setPending('');clearStored('arcpay-pending-'+id);setInfo('Payment independently verified on Arc mainnet.');}
    return result;
  },[id]);
  useEffect(()=>{
    if(!id || invoice?.txHash)return;
    let active=true;
    const poll=async()=>{
      try {
        const r=await api('/api/invoices/'+id);
        if(active){setInvoice(r.invoice);setChecking(!!r.checking);setSyncError(!!r.syncError);}
        if(pending && !r.invoice.txHash) await verify(pending);
      }catch(e){if(active){setChecking(true);setSyncError(true);if(pending)setError(errorText(e));}}
    };
    const onReturn=()=>{if(document.visibilityState==='visible')void poll();};
    window.addEventListener('focus',onReturn);document.addEventListener('visibilitychange',onReturn);
    const interval=setInterval(poll,7000);
    if(pending)void poll();
    return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',onReturn);document.removeEventListener('visibilitychange',onReturn);};
  },[id,invoice?.txHash,pending,verify]);

  async function connect():Promise<string|null> {
    if(!window.ethereum){
      if(isMobileBrowser(navigator.userAgent,navigator.maxTouchPoints)){
        window.location.assign(metaMaskDappLink(window.location.href));return null;
      }
      throw new Error('Install the MetaMask browser extension, then reload this page to connect.');
    }
    const connected=await connectAccount(window.ethereum);
    setAccount(connected);return connected;
  }
  async function run(label:string,fn:()=>Promise<void>){setError('');setInfo('');setBusy(label);try{await fn();}catch(e){setError(errorText(e));}finally{setBusy('');}}
  async function create(){await run('Creating link',async()=>{
    const recipient=await connect();if(!recipient)return;
    const r=await api('/api/invoices',{recipient,amount,note});
    setInvoice(r.invoice);setChecking(false);setSyncError(false);setId(r.invoice.id);setOwner(true);window.history.replaceState({},'',`/?pay=${r.invoice.id}`);
  });}
  async function pay(){
    if(paying.current || checking || !invoice || invoice.txHash || pending)return;
    const stored=safeStore('arcpay-pending-'+id);
    if(stored){setPending(stored);return;}
    paying.current=true;
    try {await run('Opening MetaMask',async()=>{
      let provider=window.ethereum;
      if(!provider){
        const client=await getMetaMaskClient();
        // The wallet session is established as part of Pay, never as a separate UI step.
        await client.connect({chainIds:[CHAIN_HEX]});
        provider=client.getProvider() as Provider;
      }
      setBusy('Preparing payment');
      const result=await submitInvoicePayment(provider,invoice,{
        getInvoice:async()=> {const r=await api('/api/invoices/'+id);setChecking(!!r.checking);setSyncError(!!r.syncError);if(r.checking&&!r.invoice.txHash)throw new Error('Checking Arc for an earlier payment. Please wait before paying.');return r.invoice;},
        prepare:async payer=> (await api(`/api/invoices/${id}/prepare`,{payer})).transaction,
        onAccount:setAccount,
        onReview:()=>setBusy('Confirm in MetaMask'),
      });
      if('invoice' in result){setInvoice(result.invoice);return;}
      safeStore('arcpay-pending-'+id,result.hash);setPending(result.hash);
      setInfo('Transaction submitted. Waiting for on-chain verification.');
      await verify(result.hash);
    });} finally {paying.current=false;}
  }
  async function copy(){try{await navigator.clipboard.writeText(paymentUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError('Copy the payment URL from the field below.');}}
  const paid=!!invoice?.txHash;
  return <div className="shell">
    <header className="topbar"><a className="brand" href="/" aria-label="ArcPay Link home"><span className="brand-icon"><ArrowUpRight size={23}/></span><span>ArcPay<span className="brand-light"> Link</span></span></a><div className="top-actions"><span className="network"><span/>Arc mainnet</span><>{(!id||owner)&&(mobileLink?<a className="wallet-button" href={mobileLink}><Wallet size={16}/>Open MetaMask</a>:<button className="wallet-button" disabled={!!busy} onClick={()=>run('Connecting wallet',async()=>{await connect();})}><Wallet size={16}/>{account?short(account):'Connect wallet'}</button>)}</></div></header>
    <main>
      <div className="intro"><div className="eyebrow"><span/>PAYMENTS, SIMPLIFIED</div><h1>A link. A payment.<br/><span>A little less friction.</span></h1><p>Request USDC. Share anywhere. Get paid directly to your wallet.</p></div>
      <section className="workspace" aria-label="Payment workspace">
        <div className="primary">
          <div className="card-heading"><span className="step-number">{paid?<Check size={20}/>:id?'02':'01'}</span><div><h2>{paid?'Payment received':id?(owner?'Your link is ready':'You’ve got a payment request'):'Create a payment link'}</h2><p>{paid?'Settled on Arc. Ready to verify.':id?(owner?'Send it to your payer. We’ll watch for payment.':'Check the details, then pay with your wallet.'):'A few details. One simple link.'}</p></div>{id && <a href="/" className="new-link" title="Create a new link"><Link2 size={18}/></a>}</div>
          {loading?<div className="loading"><LoaderCircle className="spin"/>Loading payment…</div>:!id?<form onSubmit={e=>{e.preventDefault();void create();}}>
            <label htmlFor="amount">Amount <span>USDC on Arc</span></label>
            <div className="amount-input"><span>$</span><input id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} maxLength={13} onChange={e=>setAmount(e.target.value)} required/><span className="coin-badge">$</span><b>USDC</b></div>
            <label htmlFor="note">What’s it for? <span>Optional</span></label><input className="text-input" id="note" placeholder="Design work, coffee, a little thank you…" maxLength={120} value={note} onChange={e=>setNote(e.target.value)}/><div className="field-note">Keep personal details out of your payment note.</div>
            <div className="receive-box"><Wallet size={19}/><div><b>Paid straight to your wallet</b><p>{account?short(account):'Connect your receiving wallet when you create a link.'}</p></div><ShieldCheck size={19}/></div>
            <button className="button primary-button" disabled={!!busy || !amount}>{busy?<LoaderCircle className="spin" size={18}/>:<Link2 size={18}/>} {busy||'Create payment link'} {!busy&&<ArrowRight size={18}/>}</button><p className="under-button">Free to create. No account. No platform fee.</p>
          </form>:invoice?<>
            <div className={'status '+(paid?'paid':pending?'pending':'')}><span/>{paid?'PAID · VERIFIED ON ARC':pending?'TRANSACTION SUBMITTED':'AWAITING PAYMENT'}</div>
            <div className="requested-amount">{invoice.amount}<span>USDC</span></div><p className="payment-note">{invoice.note||'USDC payment'}</p>
            <div className="details"><div><span>Receiving wallet</span><a href={`${EXPLORER}/address/${invoice.recipient}`} target="_blank" rel="noreferrer" className="mono">{short(invoice.recipient)} <ExternalLink size={12}/></a></div><div><span>Network</span><b>Arc mainnet</b></div><div><span>Platform fee</span><b>0 USDC</b></div></div>
            {paid?<><div className="success-note"><ShieldCheck size={20}/><span>Amount, recipient, payment reference, and successful transaction verified.</span></div><div className="receipt-details"><label>Transaction hash</label><a className="hash" href={`${EXPLORER}/tx/${invoice.txHash}`} target="_blank" rel="noreferrer">{invoice.txHash}<ExternalLink size={14}/></a><div><span>From</span><code>{invoice.payer}</code></div><div><span>To</span><code>{invoice.recipient}</code></div><div><span>Block</span><b>{invoice.blockNumber}</b></div><div><span>Confirmed</span><b>{invoice.paidAt?new Date(invoice.paidAt).toLocaleString():''}</b></div><div><span>Network fee</span><b>{invoice.fee?formatWei(invoice.fee):'0'} USDC</b></div></div><button className="button primary-button" disabled={!!busy} onClick={()=>run('Verifying receipt',async()=>{await verify(invoice.txHash!);})}><ShieldCheck size={18}/>{busy||'Verify receipt again'}<ArrowRight size={18}/></button></>:owner?<div className="owner-note"><LoaderCircle size={18} className="spin"/><span>This page updates automatically when your payer completes payment.</span></div>:pending?<div className="pending-box"><LoaderCircle className="spin" size={22}/><h3>Confirming your payment</h3><p>Keep this page open. Please don’t pay again while this transaction is pending.</p><a href={`${EXPLORER}/tx/${pending}`} target="_blank" rel="noreferrer">View transaction <ExternalLink size={13}/></a><button className="text-button" onClick={()=>run('Checking transaction',async()=>{await verify(pending);})}>Check again</button></div>:<>
              <button className="button primary-button" disabled={!!busy||checking} onClick={()=>void pay()}>{busy?<LoaderCircle className="spin" size={18}/>:<Wallet size={18}/>} {busy||(checking?'Checking Arc for payment…':'Pay with MetaMask')} {!busy&&<ArrowRight size={18}/>}</button><p className="under-button">Review {invoice.amount} USDC and the network fee in MetaMask. You approve the payment there.</p>
            </>}
            {!paid&&syncError&&<p role="status">Arc verification is temporarily unavailable. We’ll keep checking. Please check wallet activity before trying another payment.</p>}
            {!paid&&<details className="recovery"><summary>Already sent a transaction?</summary><p>Paste its hash to verify it. Only a transaction made for this exact link can be accepted. If your wallet replaced the transaction, use the new hash.</p><input aria-label="Transaction hash" className="text-input" placeholder="0x… transaction hash" value={recover} onChange={e=>setRecover(e.target.value)}/><button className="button secondary-button" disabled={!!busy||!recover} onClick={()=>run('Verifying transaction',async()=>{const r=await verify(recover);if(r.pending)setInfo('Not confirmed yet. Check its status in your wallet or explorer before retrying.');})}>Verify transaction</button>{pending&&<button className="text-button" onClick={()=>{if(window.confirm('Only reset after the explorer or wallet confirms this transaction failed, was cancelled, or was dropped. A pending transaction may still complete. Have you checked?')){clearStored('arcpay-pending-'+id);setPending('');setError('');}}}>Reset a failed or cancelled attempt</button>}</details>}
          </>:<div className="loading"><ReceiptText/><p>This payment link is unavailable.</p><a href="/">Create a new link</a></div>}
          {error&&<div className="message error" role="alert">{error}</div>}{info&&<div className="message info" role="status">{info}</div>}
        </div>
        <aside className="aside">
          {invoice?<><div className="aside-label"><QrCode size={15}/>{paid?'SHARE THE RECEIPT':'ONE LINK. READY TO SHARE.'}</div><div className="qr-frame">{qr?<img src={qr} alt="QR code opening this payment link" width={220} height={220}/>:<LoaderCircle className="spin"/>}</div><h3>{paid?'Proof comes included.':'Scan. Review. Pay.'}</h3><p>{paid?'Anyone with this link can view the receipt and verify the transaction.':'Open the request, then tap Pay with MetaMask.'}</p><input className="link-field" readOnly aria-label="Shareable payment link" value={paymentUrl} onFocus={e=>e.target.select()}/><button className="button copy-button" onClick={copy}>{copied?<Check size={17}/>:<Copy size={17}/>} {copied?'Copied!':paid?'Copy receipt link':'Copy payment link'}</button>{owner&&!paid&&<button className="text-button" onClick={()=>setOwner(false)}>Preview payer view <ArrowUpRight size={13}/></button>}<div className="tiny-note">Anyone with the link can see its amount, note, and payment details.</div></>:<><div className="aside-label"><span className="live-dot"/>SMALL LINK. REAL SETTLEMENT.</div><div className="preview-card"><div className="preview-top"><span className="preview-logo"><ArrowUpRight size={20}/></span><span>PAYMENT PREVIEW</span><span className="preview-dots">•••</span></div><p>{note||'Your next great thing'}</p><div className="preview-amount">{amount||'0.00'}<span>USDC</span></div><div className="preview-line"/><div className="preview-bottom"><span><span className="live-dot"/>Arc mainnet</span><span>Direct to wallet <ArrowUpRight size={12}/></span></div></div><div className="steps"><div><span>1</span><p><b>Make it a link</b>Choose an amount and add a note.</p></div><div><span>2</span><p><b>Send it anywhere</b>Share the link or let them scan.</p></div><div><span>3</span><p><b>See it settle</b>Get a receipt backed by the transaction.</p></div></div><div className="aside-bottom"><ShieldCheck size={17}/><span>Your wallet. Your funds. Every step.</span></div></>}
        </aside>
      </section>
      <div className="bottom-notes"><span><ShieldCheck size={16}/>Non-custodial</span><span><CheckCheck size={17}/>Verified on-chain</span><span><Wallet size={16}/>USDC for payment & gas</span></div>
    </main>
    <footer><span>ArcPay Link <span className="footer-divider">/</span> Payments with a paper trail.</span><a href="https://docs.arc.io/arc/references/connect-to-arc" target="_blank" rel="noreferrer">Built on Arc <ArrowUpRight size={13}/></a></footer>
  </div>;
}
