import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { invoices } from '@/db/schema';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const {id} = await context.params;
  const [invoice] = await getDb().select().from(invoices).where(eq(invoices.id,id)).limit(1);
  return Response.json(invoice ? {invoice} : {error:'Payment link not found.'}, {status:invoice ? 200 : 404, headers:{'Cache-Control':'no-store'}});
}
