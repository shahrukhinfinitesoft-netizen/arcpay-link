export const CHAIN_ID = 5042;
export const RPC_URL = 'https://rpc.mainnet.arc.io';
export const EXPLORER = 'https://explorer.arc.io';
export const CHAIN_HEX = '0x13b2';
export const MIN_GAS_PRICE = BigInt('20000000000');
export type Invoice = {
  id: string; recipient: string; amount: string; note: string; createdAt: number;
  data: string; txHash: string | null; payer: string | null; blockNumber: string | null;
  paidAt: number | null; fee: string | null;
};
export function amountToWei(value: string): bigint {
  if (!/^(0|[1-9]\d{0,5})(\.\d{1,6})?$/.test(value)) throw new Error('Enter an amount with up to 6 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const wei = BigInt(whole) * BigInt('1000000000000000000') + BigInt(fraction.padEnd(18, '0'));
  if (wei <= BigInt(0)) throw new Error('Amount must be greater than zero.');
  return wei;
}
export function formatWei(value: string | bigint): string {
  const n = BigInt(value), unit = BigInt('1000000000000000000');
  const fraction = (n % unit).toString().padStart(18, '0').replace(/0+$/, '');
  return `${n / unit}${fraction ? '.' + fraction : ''}`;
}
export const isAddress = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) && !/^0x0{40}$/i.test(v);
export const isHash = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);
export const short = (v: string) => `${v.slice(0, 6)}…${v.slice(-4)}`;
export async function paymentData(invoice: Pick<Invoice, 'id' | 'recipient' | 'amount' | 'note'>): Promise<string> {
  const canonical = JSON.stringify(['arcpay-link-v1', CHAIN_ID, invoice.id, invoice.recipient.toLowerCase(), amountToWei(invoice.amount).toString(), invoice.note]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return '0x41524350415901' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
export type RpcTransaction = { hash: string; from: string; to: string | null; value: string; input: string; blockHash: string | null; blockNumber: string | null; chainId?: string };
export type RpcReceipt = { status: string; transactionHash: string; blockHash: string; blockNumber: string; from: string; to: string | null; gasUsed: string; effectiveGasPrice: string };
export function validateTransaction(invoice: Invoice, hash: string, tx: RpcTransaction) {
  if (tx.hash.toLowerCase() !== hash.toLowerCase() || tx.to?.toLowerCase() !== invoice.recipient.toLowerCase() || BigInt(tx.value) !== amountToWei(invoice.amount) || tx.input.toLowerCase() !== invoice.data.toLowerCase() || (tx.chainId && BigInt(tx.chainId) !== BigInt(CHAIN_ID))) {
    throw new Error('This transaction does not match this payment link.');
  }
  if (tx.from.toLowerCase() === invoice.recipient.toLowerCase()) throw new Error('A payment must come from a different wallet.');
}
export function validateReceipt(hash: string, tx: RpcTransaction, receipt: RpcReceipt) {
  if (receipt.status !== '0x1') throw new Error('Transaction failed on-chain. No payment has been recorded.');
  if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase() || !tx.blockHash || receipt.blockHash !== tx.blockHash || receipt.blockNumber !== tx.blockNumber || receipt.to?.toLowerCase() !== tx.to?.toLowerCase() || receipt.from.toLowerCase() !== tx.from.toLowerCase()) throw new Error('Transaction receipt could not be verified.');
}
