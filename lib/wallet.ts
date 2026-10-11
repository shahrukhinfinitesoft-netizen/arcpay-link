import { CHAIN_HEX, CHAIN_ID, EXPLORER, RPC_URL, amountToWei, type Invoice } from './payment.ts';

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

export async function switchToArc(provider: WalletProvider): Promise<void> {
  if (BigInt(await provider.request({method:'eth_chainId'}) as string) === BigInt(CHAIN_ID)) return;
  try {
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN_HEX}]});
  } catch (error) {
    if ((error as {code?:number}).code !== 4902) throw error;
    await provider.request({method:'wallet_addEthereumChain',params:[{
      chainId:CHAIN_HEX,chainName:'Arc',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:18},
      rpcUrls:[RPC_URL],blockExplorerUrls:[EXPLORER],
    }]});
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN_HEX}]});
  }
  if (BigInt(await provider.request({method:'eth_chainId'}) as string) !== BigInt(CHAIN_ID)) {
    throw new Error('Switch your wallet to Arc mainnet to continue.');
  }
}

export function validatePreparedPayment(transaction: Record<string,string>, invoice: Invoice, payer: string) {
  if (transaction.from?.toLowerCase() !== payer.toLowerCase() ||
      transaction.to?.toLowerCase() !== invoice.recipient.toLowerCase() ||
      !transaction.value || BigInt(transaction.value) !== amountToWei(invoice.amount) ||
      transaction.data !== invoice.data) {
    throw new Error('Payment details changed. Reload this request before paying.');
  }
}

export async function submitInvoicePayment(provider: WalletProvider, invoice: Invoice, actions: {
  getInvoice: () => Promise<Invoice>;
  prepare: (payer: string) => Promise<Record<string,string>>;
  onAccount?: (payer: string) => void;
  onReview?: () => void;
}): Promise<{hash:string} | {invoice:Invoice}> {
  const payer = await connectAccount(provider);
  actions.onAccount?.(payer);
  await switchToArc(provider);
  const latest = await actions.getInvoice();
  if (latest.txHash) return {invoice:latest};
  const transaction = await actions.prepare(payer);
  validatePreparedPayment(transaction, invoice, payer);
  const accounts = await provider.request({method:'eth_accounts'}) as string[];
  const chain = await provider.request({method:'eth_chainId'}) as string;
  if (accounts[0]?.toLowerCase() !== payer.toLowerCase() || BigInt(chain) !== BigInt(CHAIN_ID)) {
    throw new Error('Wallet account or network changed. Please try the payment again.');
  }
  actions.onReview?.();
  // Only called by the explicit Pay action. MetaMask controls review and approval.
  const hash = await provider.request({method:'eth_sendTransaction',params:[{...transaction,chainId:CHAIN_HEX}]});
  if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error('MetaMask did not return a transaction hash. Check your wallet activity before retrying.');
  }
  return {hash};
}
