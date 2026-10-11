'use client';

import { CHAIN_HEX, RPC_URL } from './payment';
import type { MetamaskConnectEVM } from '@metamask/connect-evm';

let client: Promise<MetamaskConnectEVM> | undefined;

// Initialize the transport without requesting account access or a signature.
export function getMetaMaskClient(): Promise<MetamaskConnectEVM> {
  if (!client) {
    client = import('@metamask/connect-evm').then(({ createEVMClient }) => createEVMClient({
      dapp: { name: 'ArcPay Link', url: window.location.href },
      api: { supportedNetworks: { [CHAIN_HEX]: RPC_URL } },
      analytics: { enabled: false },
      ui: { preferExtension: true, showInstallModal: false },
    })).catch(error => { client = undefined; throw error; });
  }
  return client;
}
