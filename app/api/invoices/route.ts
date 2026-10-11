import { getDb } from '@/db';
import { invoices } from '@/db/schema';
import { amountToWei, formatWei, isAddress, paymentData } from '@/lib/payment';
import { assertMainnet, rpc } from '@/lib/arc';
export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error:'Origin not allowed.'}, {status:403});
    const raw = await request.text();
    if (raw.length > 1500) return Response.json({error:'Request is too large.'}, {status:413});
    const body = JSON.parse(raw);
    if (!isAddress(body.recipient)) throw new Error('Connect a valid receiving wallet.');
    if (typeof body.amount !== 'string' || typeof body.note !== 'string' || body.note.trim().length > 120) throw new Error('Enter a valid amount and a note of at most 120 characters.');
    const amount = formatWei(amountToWei(body.amount));
    await assertMainnet();
    if (await rpc<string>('eth_getCode', [body.recipient, 'latest']) !== '0x') throw new Error('Use a standard receiving wallet. Smart-contract receiving wallets are not supported in this version.');
    const record = { id: crypto.randomUUID(), recipient: body.recipient.toLowerCase(), amount, note: body.note.trim(), createdAt: Date.now() };
    const [invoice] = await getDb().insert(invoices).values({ ...record, data: await paymentData(record) }).returning();
    return Response.json({invoice}, {status:201, headers:{'Cache-Control':'no-store'}});
  } catch (e) { return Response.json({error:e instanceof Error ? e.message : 'Unable to create payment link.'}, {status:400}); }
}
