import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { invoices } from '@/db/schema';
import { assertMainnet, rpc } from '@/lib/arc';
import { amountToWei, assertPaymentBalance, isAddress, MIN_GAS_PRICE } from '@/lib/payment';
export async function POST(request: Request, context: {params: Promise<{id:string}>}) {
  try {
    const {id}=await context.params;
    const [invoice]=await getDb().select().from(invoices).where(eq(invoices.id,id)).limit(1);
    if (!invoice) throw new Error('Payment link not found.');
    if (invoice.txHash) throw new Error('This link has already been paid.');
    const {payer}=await request.json() as {payer:unknown};
    if (!isAddress(payer) || payer.toLowerCase() === invoice.recipient) throw new Error('Connect a different wallet to pay this link.');
    await assertMainnet();
    const [code, balance, price] = await Promise.all([rpc<string>('eth_getCode',[invoice.recipient,'latest']),rpc<string>('eth_getBalance',[payer,'latest']),rpc<string>('eth_gasPrice')]);
    if (code !== '0x') throw new Error('This receiving address is now a contract. Payment is disabled.');
    const value = amountToWei(invoice.amount);
    // Check native Arc USDC before estimation: an unfunded transaction is rejected by the RPC.
    assertPaymentBalance(BigInt(balance), value);
    const transaction = {from:payer,to:invoice.recipient,value:'0x'+value.toString(16),data:invoice.data};
    const gas = BigInt(await rpc<string>('eth_estimateGas',[transaction])) * BigInt(120) / BigInt(100);
    const gasPrice = BigInt(price) > MIN_GAS_PRICE ? BigInt(price) * BigInt(120) / BigInt(100) : MIN_GAS_PRICE;
    assertPaymentBalance(BigInt(balance), value, gas * gasPrice);
    return Response.json({transaction:{...transaction,gas:'0x'+gas.toString(16),gasPrice:'0x'+gasPrice.toString(16)},maxFee:(gas*gasPrice).toString()}, {headers:{'Cache-Control':'no-store'}});
  } catch(e) {return Response.json({error:e instanceof Error?e.message:'Unable to prepare payment.'},{status:400});}
}
