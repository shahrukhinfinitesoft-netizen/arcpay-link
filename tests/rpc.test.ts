import test from 'node:test';
import assert from 'node:assert/strict';
import { readArcRpc } from '../lib/rpc-transport.ts';
const reply = (result: unknown) => Response.json({jsonrpc:'2.0',id:1,result});
test('falls back after an HTTP rejection and verifies fallback mainnet before reading', async () => {
  const calls: string[] = [];
  const mock = (async (url, init) => {
    const {method} = JSON.parse(init!.body as string);
    calls.push(`${url}:${method}`);
    if(url === 'primary') return new Response('', {status:403});
    return reply(method === 'eth_chainId' ? '0x13b2' : '0x');
  }) as typeof fetch;
  assert.equal(await readArcRpc('eth_getCode', ['0x123','latest'], ['primary','fallback'], 5042, mock), '0x');
  assert.deepEqual(calls, ['primary:eth_chainId','fallback:eth_chainId','fallback:eth_getCode']);
});
test('a responding testnet endpoint cannot supply mainnet payment data', async () => {
  const calls: string[] = [];
  const mock = (async (_url, init) => { const {method} = JSON.parse(init!.body as string); calls.push(method); return reply('0x4cef52'); }) as typeof fetch;
  await assert.rejects(readArcRpc('eth_getBalance',[],['wrong-chain'],5042,mock), /Unable to reach Arc mainnet/);
  assert.deepEqual(calls,['eth_chainId']);
});
test('timeouts and malformed responses fail closed without inventing results', async () => {
  const mock = (async (url) => { if(url === 'timeout') throw new Error('timeout'); return Response.json({jsonrpc:"2.0",id:1}); }) as typeof fetch;
  await assert.rejects(readArcRpc('eth_chainId',[],['timeout','invalid'],5042,mock), /Unable to reach Arc mainnet/);
});

test('insufficient-funds RPC rejection is reported as a balance issue, not an outage', async () => {
  const calls: string[] = [];
  const mock = (async (url, init) => {
    const {method} = JSON.parse(init!.body as string); calls.push(`${url}:${method}`);
    return method === 'eth_chainId' ? reply('0x13b2') : Response.json({error:{code:-32003,message:'revert: OutOfFunds'}});
  }) as typeof fetch;
  await assert.rejects(readArcRpc('eth_estimateGas',[],['primary','fallback'],5042,mock), /Not enough USDC on Arc mainnet/);
  assert.deepEqual(calls,['primary:eth_chainId','primary:eth_estimateGas']);
});
