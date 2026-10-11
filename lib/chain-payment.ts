import { amountToWei, validateTransaction, validateReceipt, type Invoice, type RpcReceipt, type RpcTransaction } from './payment.ts';
export type ChainReader = <T>(method: string, params?: unknown[]) => Promise<T>;
export const NATIVE_USDC_EMITTER='0xfffffffffffffffffffffffffffffffffffffffe';
export const TRANSFER_TOPIC='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
export const hex=(block:bigint)=>'0x'+block.toString(16);
export type PaymentProof={txHash:string;payer:string;blockNumber:string;paidAt:number;fee:string};
export async function verifyOnChain(invoice:Invoice,hash:string,read:ChainReader):Promise<PaymentProof|null>{
  const [tx,receipt]=await Promise.all([read<RpcTransaction|null>('eth_getTransactionByHash',[hash]),read<RpcReceipt|null>('eth_getTransactionReceipt',[hash])]);
  if(tx)validateTransaction(invoice,hash,tx);
  if(!tx||!receipt)return null;
  validateReceipt(hash,tx,receipt);
  const block=await read<{hash:string;timestamp:string}>('eth_getBlockByNumber',[receipt.blockNumber,false]);
  if(!block||block.hash!==receipt.blockHash)throw new Error('Block verification failed. Try again.');
  const paidAt=Number(BigInt(block.timestamp))*1000;
  if(paidAt<invoice.createdAt-120000)throw new Error('Transaction predates this payment link.');
  return {txHash:hash.toLowerCase(),payer:tx.from.toLowerCase(),blockNumber:BigInt(receipt.blockNumber).toString(),paidAt,fee:(BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice)).toString()};
}
// Older requests predate the scan checkpoint migration. Find their creation block once.
export async function findStartBlock(createdAt:number,head:bigint,read:ChainReader):Promise<bigint>{
  const threshold=BigInt(Math.max(0,Math.floor(createdAt/1000)-120));
  let low=0n,high=head;
  while(low<high){
    const mid=(low+high)/2n;
    const block=await read<{timestamp:string}>('eth_getBlockByNumber',[hex(mid),false]);
    if(!block)throw new Error('Unable to locate payment creation block.');
    if(BigInt(block.timestamp)<threshold)low=mid+1n;else high=mid;
  }
  return low;
}
type TransferLog={address:string;topics:string[];data:string;transactionHash:string;removed?:boolean};
export async function discoverPayment(invoice:Invoice,fromBlock:bigint,head:bigint,read:ChainReader){
  // Keep each request bounded and resume from a persisted checkpoint on the next poll.
  let end=fromBlock+999n<head?fromBlock+999n:head;
  if(fromBlock>head)return {scannedThrough:head,payment:null,catchingUp:false};
  let candidates:string[]=[];
  while(true){
    const logs=await read<TransferLog[]>('eth_getLogs',[{address:NATIVE_USDC_EMITTER,topics:[TRANSFER_TOPIC,null,'0x'+invoice.recipient.slice(2).toLowerCase().padStart(64,'0')],fromBlock:hex(fromBlock),toBlock:hex(end)}]);
    candidates=[...new Set(logs.filter(log=>!log.removed&&log.address.toLowerCase()===NATIVE_USDC_EMITTER&&log.topics[0]===TRANSFER_TOPIC&&log.topics[2]?.toLowerCase()==='0x'+invoice.recipient.slice(2).toLowerCase().padStart(64,'0')&&BigInt(log.data)===amountToWei(invoice.amount)).map(log=>log.transactionHash))];
    if(candidates.length<=12)break;
    if(end===fromBlock)throw new Error('Payment scan requires transaction-hash recovery for this busy block.');
    end=fromBlock+(end-fromBlock)/2n;
  }
  for(const hash of candidates){
    const tx=await read<RpcTransaction|null>('eth_getTransactionByHash',[hash]);
    if(!tx)throw new Error('Arc has not returned the candidate transaction yet.');
    try{validateTransaction(invoice,hash,tx);}catch{continue;}
    const payment=await verifyOnChain(invoice,hash,read);
    if(!payment)throw new Error('Arc has not returned the payment receipt yet.');
    return {scannedThrough:end,payment,catchingUp:false};
  }
  return {scannedThrough:end,payment:null,catchingUp:end<head};
}
