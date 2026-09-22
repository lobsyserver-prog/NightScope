import { describe, expect, it } from 'vitest';
import { UserAccountService } from '../services/userAccounts';

describe('UserAccountService', () => {
  it('creates a user ID, authenticates with the password, and never exposes the password', () => {
    const service = new UserAccountService();
    const created = service.register('owner', { fullName: 'Property Owner', email: 'owner@example.com' }, 'A-secure-password-1');

    expect(created.userId).toMatch(/^owner-/);
    expect(service.authenticate(created.userId, 'A-secure-password-1')).toMatchObject({
      userId: created.userId,
      role: 'owner',
      profile: { fullName: 'Property Owner' },
    });
    expect(service.authenticate(created.userId, 'A-secure-password-1')).not.toHaveProperty('password');
    expect(() => service.authenticate(created.userId, 'wrong-password')).toThrow('Invalid user ID or password');
  });

  it('lets the profile owner update and remove their information', () => {
    const service = new UserAccountService();
    const created = service.register('guest', { fullName: 'Guest', phone: '+27000000000', address: 'Private address' }, 'A-secure-password-1');

    service.updateProfile(created.userId, created.userId, { phone: '+27111111111' });
    const updated = service.removeProfileInformation(created.userId, created.userId, ['address']);

    expect(updated.profile).toEqual({ fullName: 'Guest', phone: '+27111111111' });
  });

  it('allows admins to manage profiles but blocks other users', () => {
    const service = new UserAccountService();
    const owner = service.register('owner', { fullName: 'Owner' }, 'A-secure-password-1');
    const guest = service.register('guest', { fullName: 'Guest' }, 'A-secure-password-1');
    const admin = service.register('admin', { fullName: 'Admin' }, 'A-secure-password-1');

    expect(() => service.updateProfile(guest.userId, owner.userId, { fullName: 'Changed' })).toThrow('only manage their own profile');
    expect(service.updateProfile(admin.userId, owner.userId, { fullName: 'Changed by Admin' }).profile.fullName).toBe('Changed by Admin');
  });

  it('requires a strong password and supports password changes', () => {
    const service = new UserAccountService();
    expect(() => service.register('guest', {}, 'short')).toThrow('at least 12 characters');
    const created = service.register('guest', {}, 'A-secure-password-1');

    service.changePassword(created.userId, 'A-secure-password-1', 'Another-secure-password-2');
    expect(() => service.authenticate(created.userId, 'A-secure-password-1')).toThrow('Invalid user ID or password');
    expect(service.authenticate(created.userId, 'Another-secure-password-2').userId).toBe(created.userId);
  });
});
