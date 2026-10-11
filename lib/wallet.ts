export type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, fn: (value: unknown) => void) => void;
  removeListener?: (event: string, fn: (value: unknown) => void) => void;
};

// Official MetaMask dapp universal link. Opens a page, never a payment/signing request.
export function metaMaskDappLink(page: string): string {
  const url = new URL(page);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('MetaMask requires a secure payment page.');
  }
  return `https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}${url.hash}`;
}

export function isMobileBrowser(userAgent: string, touchPoints = 0): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1);
}

export async function connectAccount(provider: WalletProvider): Promise<string> {
  let accounts = await provider.request({ method: 'eth_accounts' }) as string[];
  if (!accounts[0]) accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
  if (!accounts[0]) throw new Error('Choose a wallet account to continue.');
  return accounts[0];
}
