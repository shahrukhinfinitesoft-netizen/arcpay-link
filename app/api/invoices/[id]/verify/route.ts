import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { invoices } from '@/db/schema';
import { assertMainnet, rpc } from '@/lib/arc';
import { isHash, validateTransaction, validateReceipt, type RpcTransaction, type RpcReceipt } from '@/lib/payment';
export async function POST(request: Request, context: {params: Promise<{id:string}>}) {
  try {
    const {id}=await context.params;
    const db=getDb();
    const [invoice]=await db.select().from(invoices).where(eq(invoices.id,id)).limit(1);
    if (!invoice) throw new Error('Payment link not found.');
    const {hash}=await request.json() as {hash:unknown};
    if (!isHash(hash)) throw new Error('Enter a valid transaction hash.');
    if (invoice.txHash && invoice.txHash !== hash.toLowerCase()) throw new Error('This payment link already has a verified receipt.');
    await assertMainnet();
    const [tx,receipt]=await Promise.all([rpc<RpcTransaction|null>('eth_getTransactionByHash',[hash]),rpc<RpcReceipt|null>('eth_getTransactionReceipt',[hash])]);
    if (tx) validateTransaction(invoice,hash,tx);
    if (!tx || !receipt) return Response.json({pending:true},{status:202});
    validateReceipt(hash,tx,receipt);
    const block=await rpc<{hash:string;timestamp:string}>('eth_getBlockByNumber',[receipt.blockNumber,false]);
    if (!block || block.hash !== receipt.blockHash) throw new Error('Block verification failed. Try again.');
    if (Number(BigInt(block.timestamp))*1000 < invoice.createdAt-120000) throw new Error('Transaction predates this payment link.');
    await db.update(invoices).set({txHash:hash.toLowerCase(),payer:tx.from.toLowerCase(),blockNumber:BigInt(receipt.blockNumber).toString(),paidAt:Number(BigInt(block.timestamp))*1000,fee:(BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice)).toString()}).where(and(eq(invoices.id,id),isNull(invoices.txHash)));
    const [updated]=await db.select().from(invoices).where(eq(invoices.id,id)).limit(1);
    return Response.json({invoice:updated},{headers:{'Cache-Control':'no-store'}});
  } catch(e) {return Response.json({error:e instanceof Error?e.message:'Unable to verify transaction.'},{status:400});}
}
