import { CHAIN_ID, RPC_URL } from './payment';
export async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const response = await fetch(RPC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Arc network is temporarily unavailable. Please try again.');
  const result = await response.json() as { result?: T; error?: { message: string } };
  if (result.error || result.result === undefined) throw new Error('Arc could not complete this request. Please try again.');
  return result.result;
}
export async function assertMainnet() {
  if (BigInt(await rpc<string>('eth_chainId')) !== BigInt(CHAIN_ID)) throw new Error('Network verification failed. Payments are disabled.');
}
