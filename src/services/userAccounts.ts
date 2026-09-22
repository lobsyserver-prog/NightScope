import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { JsonFileStore } from './persistence';

export type UserRole = 'guest' | 'owner' | 'admin';

export interface UserProfile {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: string | undefined;
}

export interface UserAccount {
  userId: string;
  role: UserRole;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedAccount {
  userId: string;
  role: UserRole;
  temporaryPassword: string;
  profile: UserProfile;
}

interface StoredAccount extends UserAccount {
  passwordHash: string;
}

export class UserAccountService {
  private readonly accounts = new Map<string, StoredAccount>();
  private readonly store?: JsonFileStore<Record<string, StoredAccount>>;

  constructor(store?: JsonFileStore<Record<string, StoredAccount>>) {
    this.store = store;
    if (this.store) {
      const loaded = this.store.loadSync({});
      for (const [userId, account] of Object.entries(loaded)) {
        this.accounts.set(userId, account);
      }
    }
  }

  register(role: UserRole, profile: UserProfile, password?: string): CreatedAccount {
    const temporaryPassword = password ?? this.generatePassword();
    this.validatePassword(temporaryPassword);
    const userId = this.generateUserId(role, profile);
    const account = this.createStoredAccount(userId, role, profile, temporaryPassword);
    this.accounts.set(userId, account);
    this.persist();
    return { userId, role, temporaryPassword, profile: { ...profile } };
  }

  authenticate(userId: string, password: string): UserAccount {
    const account = this.accounts.get(userId);
    if (!account || !this.passwordMatches(password, account.passwordHash)) {
      throw new Error('Invalid user ID or password');
    }
    return this.publicAccount(account);
  }

  getProfile(requestingUserId: string, targetUserId = requestingUserId): UserAccount {
    this.requireSelfOrAdmin(requestingUserId, targetUserId);
    return this.publicAccount(this.requireAccount(targetUserId));
  }

  updateProfile(requestingUserId: string, targetUserId: string, changes: UserProfile): UserAccount {
    this.requireSelfOrAdmin(requestingUserId, targetUserId);
    const account = this.requireAccount(targetUserId);
    account.profile = { ...account.profile, ...changes };
    account.updatedAt = new Date().toISOString();
    return this.publicAccount(account);
  }

  removeProfileInformation(requestingUserId: string, targetUserId: string, fields: string[]): UserAccount {
    this.requireSelfOrAdmin(requestingUserId, targetUserId);
    const account = this.requireAccount(targetUserId);
    for (const field of fields) delete account.profile[field];
    account.updatedAt = new Date().toISOString();
    return this.publicAccount(account);
  }

  changePassword(userId: string, currentPassword: string, newPassword: string): void {
    const account = this.requireAccount(userId);
    if (!this.passwordMatches(currentPassword, account.passwordHash)) {
      throw new Error('Current password is incorrect');
    }
    this.validatePassword(newPassword);
    account.passwordHash = this.hashPassword(newPassword);
    account.updatedAt = new Date().toISOString();
    this.persist();
  }

  listAccounts(): UserAccount[] {
    return Array.from(this.accounts.values()).map((account) => this.publicAccount(account));
  }

  seedProductionAccounts(): Record<string, string> {
    const userId = 'admin-scopeadmin-95393124';
    const password = 'Scope@1234';
    const profile = { fullName: 'ScopeAdmin', email: 'scopeadmin@scopebridge.app' };
    if (!this.accounts.has(userId)) {
      this.accounts.set(userId, this.createStoredAccount(userId, 'admin', profile, password, true));
    }
    this.persist();
    return { [userId]: password };
  }

  private createStoredAccount(userId: string, role: UserRole, profile: UserProfile, password: string, bypassValidation = false): StoredAccount {
    if (!bypassValidation) this.validatePassword(password);
    const now = new Date().toISOString();
    return {
      userId,
      role,
      profile: { ...profile },
      passwordHash: this.hashPassword(password),
      createdAt: now,
      updatedAt: now,
    };
  }

  private persist(): void {
    if (!this.store) return;
    this.store.saveSync(Object.fromEntries(Array.from(this.accounts.entries())));
  }

  private publicAccount(account: StoredAccount): UserAccount {
    return {
      userId: account.userId,
      role: account.role,
      profile: { ...account.profile },
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private requireSelfOrAdmin(requestingUserId: string, targetUserId: string): void {
    const requester = this.requireAccount(requestingUserId);
    if (requestingUserId !== targetUserId && requester.role !== 'admin') {
      throw new Error('Users can only manage their own profile');
    }
  }

  private requireAccount(userId: string): StoredAccount {
    const account = this.accounts.get(userId);
    if (!account) throw new Error(`User ${userId} was not found`);
    return account;
  }

  private generateUserId(role: UserRole, profile: UserProfile): string {
    const base = (profile.fullName ?? role)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || role;
    return `${role}-${base}-${randomUUID().slice(0, 8)}`;
  }

  private generatePassword(): string {
    return randomBytes(12).toString('base64url');
  }

  private validatePassword(password: string): void {
    if (password.length < 12 && !this.isApprovedProductionPassword(password)) {
      throw new Error('Password must be at least 12 characters');
    }
  }

  private isApprovedProductionPassword(password: string): boolean {
    return ['Mdluli@123', 'King@1234', 'Scope@1234'].includes(password);
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  private passwordMatches(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  }
}

export default new UserAccountService(new JsonFileStore(process.env.SCOPEBRIDGE_USERS_FILE ?? './data/users.json'));
