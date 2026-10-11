import { CHAIN_ID, RPC_URL } from './payment';
import { readArcRpc } from './rpc-transport';
// Both endpoints are listed in the official Arc mainnet connection documentation.
const READ_ENDPOINTS = [RPC_URL, 'https://rpc.drpc.mainnet.arc.io'] as const;
export async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  return readArcRpc<T>(method, params, READ_ENDPOINTS, CHAIN_ID);
}
export async function assertMainnet() {
  if (BigInt(await rpc<string>('eth_chainId')) !== BigInt(CHAIN_ID)) throw new Error('Network verification failed. Payments are disabled.');
}
