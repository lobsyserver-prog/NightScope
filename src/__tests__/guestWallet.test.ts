import { describe, expect, it } from 'vitest';
import { GuestWalletService } from '../services/guestWallet';

describe('GuestWalletService', () => {
  it('creates a guest wallet and tracks holiday savings progress', () => {
    const service = new GuestWalletService();
    const wallet = service.createWallet('guest-1', 'zar', 100_000);

    service.deposit(wallet.id, 25_000, 'monthly-saving');
    service.deposit(wallet.id, 15_000);

    expect(service.getProgress(wallet.id)).toMatchObject({
      balanceMinor: 40_000,
      goalAmountMinor: 100_000,
      remainingMinor: 60_000,
      percentageComplete: 40,
      currency: 'ZAR',
    });
    expect(service.getTransactions(wallet.id)).toHaveLength(2);
  });

  it('allows withdrawals only within the available balance', () => {
    const service = new GuestWalletService();
    const wallet = service.createWallet('guest-1', 'ZAR', 50_000);
    service.deposit(wallet.id, 20_000);

    const withdrawal = service.withdraw(wallet.id, 5_000, 'booking-credit');

    expect(withdrawal.balanceAfterMinor).toBe(15_000);
    expect(() => service.withdraw(wallet.id, 20_000)).toThrow('cannot exceed wallet balance');
  });

  it('prevents duplicate wallets and invalid money values', () => {
    const service = new GuestWalletService();
    service.createWallet('guest-1', 'ZAR', 50_000);

    expect(() => service.createWallet('guest-1', 'ZAR', 50_000)).toThrow('already exists');
    expect(() => service.createWallet('guest-2', 'ZAR', 0)).toThrow('positive integer');
    expect(() => service.deposit('missing-wallet', 100)).toThrow('was not found');
  });

  it('closes a wallet and blocks further transactions', () => {
    const service = new GuestWalletService();
    const wallet = service.createWallet('guest-1', 'ZAR', 50_000);

    service.closeWallet(wallet.id);

    expect(() => service.deposit(wallet.id, 1_000)).toThrow('is closed');
  });
});
