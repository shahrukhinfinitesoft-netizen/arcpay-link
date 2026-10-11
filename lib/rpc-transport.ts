export class ArcRpcRequestError extends Error {}

// Read-only failover. No transaction is submitted or retried by this transport.
export async function readArcRpc<T>(
  method: string,
  params: unknown[],
  endpoints: readonly string[],
  chainId: number,
  fetcher: typeof fetch = fetch,
  verifiedEndpoints = new Set<string>(),
): Promise<T> {
  const read = async (endpoint: string, rpcMethod: string, rpcParams: unknown[]): Promise<unknown> => {
    const response = await fetcher(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: rpcMethod, params: rpcParams }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json() as { result?: unknown; error?: {code?: number; message?: string} };
    if (result.error) {
      const message = result.error.message || '';
      if (/OutOfFunds|insufficient funds/i.test(message)) {
        throw new ArcRpcRequestError('Not enough USDC on Arc mainnet. USDC on Solana or another network cannot pay this request.');
      }
      throw new ArcRpcRequestError(`Arc rejected this request (RPC error ${result.error.code ?? 'unknown'}).`);
    }
    if (result.result === undefined) throw new Error('Invalid RPC response');
    return result.result;
  };
  for (const endpoint of endpoints) {
    try {
      // Check the chain on the same endpoint used for the requested read.
      const chain = method === 'eth_chainId' || !verifiedEndpoints.has(endpoint) ? await read(endpoint, 'eth_chainId', []) : '0x' + chainId.toString(16);
      if (typeof chain !== 'string' || BigInt(chain) !== BigInt(chainId)) {
        console.error('Arc RPC chain mismatch', { endpoint });
        continue;
      }
      verifiedEndpoints.add(endpoint);
      return (method === 'eth_chainId' ? chain : await read(endpoint, method, params)) as T;
    } catch (error) {
      if (error instanceof ArcRpcRequestError) throw error;
      // No account addresses, notes, request bodies, tokens, or response bodies logged.
      console.warn('Arc RPC read failed', { endpoint, method, reason: error instanceof Error ? error.message : 'Fetch failed' });
    }
  }
  throw new Error('Unable to reach Arc mainnet. Please try again shortly.');
}
