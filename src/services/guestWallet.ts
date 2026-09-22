export type WalletTransactionType = 'deposit' | 'withdrawal';

export interface GuestWallet {
  id: string;
  guestId: string;
  currency: string;
  goalAmountMinor: number;
  balanceMinor: number;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amountMinor: number;
  balanceAfterMinor: number;
  reference?: string;
  createdAt: string;
}

export interface WalletProgress {
  walletId: string;
  balanceMinor: number;
  goalAmountMinor: number;
  remainingMinor: number;
  percentageComplete: number;
  currency: string;
}

export class GuestWalletService {
  private readonly wallets = new Map<string, GuestWallet>();
  private readonly transactions = new Map<string, WalletTransaction[]>();
  private walletSequence = 0;
  private transactionSequence = 0;

  createWallet(guestId: string, currency: string, goalAmountMinor: number): GuestWallet {
    if (!guestId.trim()) {
      throw new Error('guestId is required');
    }
    if (!currency.trim()) {
      throw new Error('currency is required');
    }
    this.validateAmount(goalAmountMinor, 'goalAmountMinor');

    if (this.getWalletForGuest(guestId)) {
      throw new Error(`A wallet already exists for guest ${guestId}`);
    }

    const now = new Date().toISOString();
    const wallet: GuestWallet = {
      id: `guest-wallet-${++this.walletSequence}`,
      guestId,
      currency: currency.toUpperCase(),
      goalAmountMinor,
      balanceMinor: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.wallets.set(wallet.id, wallet);
    this.transactions.set(wallet.id, []);
    return wallet;
  }

  getWallet(walletId: string): GuestWallet | undefined {
    return this.wallets.get(walletId);
  }

  getWalletForGuest(guestId: string): GuestWallet | undefined {
    return Array.from(this.wallets.values()).find((wallet) => wallet.guestId === guestId);
  }

  deposit(walletId: string, amountMinor: number, reference?: string): WalletTransaction {
    return this.recordTransaction(walletId, 'deposit', amountMinor, reference);
  }

  withdraw(walletId: string, amountMinor: number, reference?: string): WalletTransaction {
    const wallet = this.requireActiveWallet(walletId);
    this.validateAmount(amountMinor, 'amountMinor');

    if (amountMinor > wallet.balanceMinor) {
      throw new Error('Withdrawal amount cannot exceed wallet balance');
    }

    return this.recordTransaction(walletId, 'withdrawal', amountMinor, reference);
  }

  getTransactions(walletId: string): WalletTransaction[] {
    if (!this.wallets.has(walletId)) {
      throw new Error(`Wallet ${walletId} was not found`);
    }
    return [...(this.transactions.get(walletId) ?? [])];
  }

  getProgress(walletId: string): WalletProgress {
    const wallet = this.requireWallet(walletId);
    const remainingMinor = Math.max(wallet.goalAmountMinor - wallet.balanceMinor, 0);

    return {
      walletId: wallet.id,
      balanceMinor: wallet.balanceMinor,
      goalAmountMinor: wallet.goalAmountMinor,
      remainingMinor,
      percentageComplete: Math.min((wallet.balanceMinor / wallet.goalAmountMinor) * 100, 100),
      currency: wallet.currency,
    };
  }

  closeWallet(walletId: string): GuestWallet {
    const wallet = this.requireWallet(walletId);
    wallet.status = 'closed';
    wallet.updatedAt = new Date().toISOString();
    return wallet;
  }

  private recordTransaction(
    walletId: string,
    type: WalletTransactionType,
    amountMinor: number,
    reference?: string
  ): WalletTransaction {
    const wallet = this.requireActiveWallet(walletId);
    this.validateAmount(amountMinor, 'amountMinor');

    wallet.balanceMinor += type === 'deposit' ? amountMinor : -amountMinor;
    wallet.updatedAt = new Date().toISOString();

    const transaction: WalletTransaction = {
      id: `wallet-transaction-${++this.transactionSequence}`,
      walletId,
      type,
      amountMinor,
      balanceAfterMinor: wallet.balanceMinor,
      reference,
      createdAt: wallet.updatedAt,
    };

    this.transactions.get(walletId)?.push(transaction);
    return transaction;
  }

  private requireWallet(walletId: string): GuestWallet {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} was not found`);
    }
    return wallet;
  }

  private requireActiveWallet(walletId: string): GuestWallet {
    const wallet = this.requireWallet(walletId);
    if (wallet.status !== 'active') {
      throw new Error(`Wallet ${walletId} is closed`);
    }
    return wallet;
  }

  private validateAmount(amountMinor: number, fieldName: string): void {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error(`${fieldName} must be a positive integer in minor currency units`);
    }
  }
}

export default new GuestWalletService();
