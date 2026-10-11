import test from 'node:test';
import assert from 'node:assert/strict';
import { connectAccount, isMobileBrowser, metaMaskDappLink } from '../lib/wallet.ts';

test('mobile dapp link preserves the exact payment URL and opens no signing request', () => {
  const target = 'https://arcpay-link.faircalf64.chatgpt.site/?pay=abc-123';
  assert.equal(metaMaskDappLink(target), 'https://metamask.app.link/dapp/arcpay-link.faircalf64.chatgpt.site/?pay=abc-123');
  assert.equal(metaMaskDappLink('https://example.com/pay?a=1&b=2#receipt'), 'https://metamask.app.link/dapp/example.com/pay?a=1&b=2#receipt');
  assert.throws(() => metaMaskDappLink('http://example.com'));
  assert.throws(() => metaMaskDappLink('https://user:password@example.com'));
});
test('detects phone and iPad desktop user agents without affecting desktop extensions', () => {
  assert.equal(isMobileBrowser('Android'), true);
  assert.equal(isMobileBrowser('iPhone'), true);
  assert.equal(isMobileBrowser('Macintosh', 5), true);
  assert.equal(isMobileBrowser('Macintosh', 0), false);
  assert.equal(isMobileBrowser('Windows NT'), false);
});
test('existing wallet access does not request additional permission', async () => {
  const calls: string[] = [];
  const account = await connectAccount({request: async ({method}) => { calls.push(method); return ['0x123']; }});
  assert.equal(account, '0x123');
  assert.deepEqual(calls, ['eth_accounts']);
});
test('first connection requests only accounts, no signatures or spending permission', async () => {
  const calls: string[] = [];
  await connectAccount({request: async ({method}) => { calls.push(method); return method === 'eth_accounts' ? [] : ['0x123']; }});
  assert.deepEqual(calls, ['eth_accounts', 'eth_requestAccounts']);
});
