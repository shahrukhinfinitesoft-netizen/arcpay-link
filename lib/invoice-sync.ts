import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { invoices } from '@/db/schema';
import { createMainnetReader } from './arc';
import { discoverPayment, findStartBlock, type PaymentProof } from './chain-payment';

type StoredInvoice=typeof invoices.$inferSelect;
export async function recordPayment(id:string,payment:PaymentProof){
  const db=getDb();
  await db.update(invoices).set(payment).where(and(eq(invoices.id,id),isNull(invoices.txHash)));
  const [updated]=await db.select().from(invoices).where(eq(invoices.id,id)).limit(1);
  return updated;
}
export async function syncInvoice(invoice:StoredInvoice){
  if(invoice.txHash)return {invoice,checking:false};
  const db=getDb(),now=Date.now();
  // A persisted lease prevents payer/creator polls from duplicating scans.
  if(invoice.scanCheckedAt&&now-invoice.scanCheckedAt<60000)return {invoice,checking:true};
  const [leased]=await db.update(invoices).set({scanCheckedAt:now}).where(and(eq(invoices.id,invoice.id),isNull(invoices.txHash),invoice.scanCheckedAt===null?isNull(invoices.scanCheckedAt):eq(invoices.scanCheckedAt,invoice.scanCheckedAt))).returning();
  if(!leased){const [latest]=await db.select().from(invoices).where(eq(invoices.id,invoice.id)).limit(1);return {invoice:latest,checking:!latest.txHash};}
  try{
    const read=createMainnetReader(),head=BigInt(await read<string>('eth_blockNumber'));
    if(invoice.startBlock===null){
      const start=await findStartBlock(invoice.createdAt,head,read);
      await db.update(invoices).set({startBlock:start.toString(),scanCheckedAt:null}).where(and(eq(invoices.id,invoice.id),eq(invoices.scanCheckedAt,now),isNull(invoices.startBlock)));
      return {invoice:{...leased,startBlock:start.toString()},checking:true};
    }
    const from=invoice.scanBlock===null?BigInt(invoice.startBlock):BigInt(invoice.scanBlock)+1n;
    const result=await discoverPayment(invoice,from,head,read);
    if(result.payment)return {invoice:await recordPayment(invoice.id,result.payment),checking:false};
    await db.update(invoices).set({scanBlock:result.scannedThrough.toString(),scanCheckedAt:null}).where(and(eq(invoices.id,invoice.id),isNull(invoices.txHash),eq(invoices.scanCheckedAt,now)));
    const [latest]=await db.select().from(invoices).where(eq(invoices.id,invoice.id)).limit(1);
    return {invoice:latest,checking:!latest.txHash&&result.catchingUp};
  }catch(error){
    await db.update(invoices).set({scanCheckedAt:null}).where(and(eq(invoices.id,invoice.id),eq(invoices.scanCheckedAt,now)));
    console.error('Arc payment discovery failed',{reason:error instanceof Error?error.message:'Scan failed'});
    return {invoice:leased,checking:true,syncError:true};
  }
}
