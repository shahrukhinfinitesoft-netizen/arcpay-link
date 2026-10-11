import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { invoices } from '@/db/schema';
import { syncInvoice } from '@/lib/invoice-sync';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const {id} = await context.params;
  const [invoice] = await getDb().select().from(invoices).where(eq(invoices.id,id)).limit(1);
  if(!invoice)return Response.json({error:'Payment link not found.'},{status:404});
  return Response.json(await syncInvoice(invoice), {headers:{'Cache-Control':'no-store'}});
}
