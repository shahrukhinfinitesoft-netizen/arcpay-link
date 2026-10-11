import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { invoices } from '@/db/schema';
import { createMainnetReader } from '@/lib/arc';
import { isHash } from '@/lib/payment';
import { verifyOnChain } from '@/lib/chain-payment';
import { recordPayment } from '@/lib/invoice-sync';
export async function POST(request: Request, context: {params: Promise<{id:string}>}) {
  try {
    const {id}=await context.params;
    const [invoice]=await getDb().select().from(invoices).where(eq(invoices.id,id)).limit(1);
    if(!invoice)throw new Error('Payment link not found.');
    const {hash}=await request.json() as {hash:unknown};
    if(!isHash(hash))throw new Error('Enter a valid transaction hash.');
    if(invoice.txHash&&invoice.txHash!==hash.toLowerCase())throw new Error('This payment link already has a verified receipt.');
    const payment=await verifyOnChain(invoice,hash,createMainnetReader());
    if(!payment)return Response.json({pending:true},{status:202});
    return Response.json({invoice:await recordPayment(id,payment)},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Unable to verify transaction.'},{status:400});}
}
