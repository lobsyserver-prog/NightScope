import { randomInt } from 'node:crypto';
import { JsonFileStore } from './persistence';

export const OWNER_MENU_OPTIONS = [
  'Dynamic Pricing',
  'Channel Manager',
  'Payout Dashboard',
  'Add-on Sales',
  'Calendar Sync + Block Dates',
  'Automated WhatsApp Messages',
  'Cleaning Tasks',
  'Smart Lock / Access Codes',
  'ID Verification + Deposit',
  'Reviews Manager',
  'Reports / Analytics',
  'Promo Codes',
  'Multi-Property Management',
] as const;

export interface PayoutRecord {
  propertyId: string;
  bookingId: string;
  amountMinor: number;
  currency: string;
  status: 'pending' | 'paid';
  paidAt?: string;
}

export interface AddOn {
  id: string;
  name: string;
  priceMinor: number;
  currency: string;
  isActive: boolean;
}

export interface CleaningTask {
  id: string;
  propertyId: string;
  roomId: string;
  checkoutAt: string;
  status: 'assigned' | 'completed';
  cleanerId?: string;
}

export interface ReviewRecord {
  id: string;
  propertyId: string;
  guestId: string;
  rating: number;
  comment: string;
  response?: string;
  reviewRequested: boolean;
}

export interface BookingAnalytics {
  propertyId: string;
  month: string;
  platform: string;
  revenueMinor: number;
  nights: number;
}

export interface OwnerProperty {
  id: string;
  ownerId: string;
  name: string;
  address: string;
}

export class OwnerManagementService {
  private readonly payouts: PayoutRecord[] = [];
  private readonly addOns = new Map<string, AddOn>();
  private readonly blockedDates: Array<{ propertyId: string; startDate: string; endDate: string }> = [];
  private readonly cleaningTasks: CleaningTask[] = [];
  private readonly reviews: ReviewRecord[] = [];
  private readonly analytics: BookingAnalytics[] = [];
  private readonly analyticsStore: JsonFileStore<BookingAnalytics[]>;
  private analyticsPersistence: Promise<void> = Promise.resolve();
  private analyticsInitialized = false;
  private readonly promoCodes = new Map<string, number>();
  private readonly properties = new Map<string, OwnerProperty>();
  private addOnSequence = 0;
  private taskSequence = 0;
  private reviewSequence = 0;

  constructor(analyticsStore = new JsonFileStore<BookingAnalytics[]>(process.env.SCOPEBRIDGE_REPORTING_FILE ?? './data/reporting.json')) {
    this.analyticsStore = analyticsStore;
  }

  async initialize(): Promise<void> {
    if (this.analyticsInitialized) return;
    this.analytics.push(...await this.analyticsStore.load([]));
    this.analyticsInitialized = true;
  }

  async flush(): Promise<void> {
    await this.analyticsPersistence;
  }

  getOwnerMenu(): readonly string[] {
    return OWNER_MENU_OPTIONS;
  }

  calculateDynamicPrice(baseRateMinor: number, date: string, holiday = false, occupancyPercent = 0): number {
    if (!Number.isSafeInteger(baseRateMinor) || baseRateMinor <= 0 || Number.isNaN(Date.parse(date))) {
      throw new Error('A positive base rate and valid date are required');
    }
    const day = new Date(date).getUTCDay();
    let multiplier = day === 0 || day === 6 ? 1.15 : 1;
    if (holiday) multiplier += 0.25;
    if (occupancyPercent >= 80) multiplier += 0.2;
    return Math.round(baseRateMinor * multiplier);
  }

  recordPayout(payout: PayoutRecord): PayoutRecord {
    if (payout.amountMinor <= 0) throw new Error('Payout amount must be positive');
    this.payouts.push({ ...payout });
    return payout;
  }

  getPayoutDashboard(propertyId?: string): { paidMinor: number; pendingMinor: number; currency: string } {
    const payouts = propertyId ? this.payouts.filter((payout) => payout.propertyId === propertyId) : this.payouts;
    return {
      paidMinor: payouts.filter((payout) => payout.status === 'paid').reduce((sum, payout) => sum + payout.amountMinor, 0),
      pendingMinor: payouts.filter((payout) => payout.status === 'pending').reduce((sum, payout) => sum + payout.amountMinor, 0),
      currency: payouts[0]?.currency ?? 'ZAR',
    };
  }

  addAddOn(input: Omit<AddOn, 'id' | 'isActive'>): AddOn {
    if (!input.name.trim() || input.priceMinor <= 0) throw new Error('Add-on name and positive price are required');
    const addOn = { ...input, id: `addon-${++this.addOnSequence}`, isActive: true, currency: input.currency.toUpperCase() };
    this.addOns.set(addOn.id, addOn);
    return addOn;
  }

  getActiveAddOns(): AddOn[] {
    return Array.from(this.addOns.values()).filter((addOn) => addOn.isActive);
  }

  blockDates(propertyId: string, startDate: string, endDate: string): void {
    this.validateDateRange(startDate, endDate);
    if (this.blockedDates.some((blocked) => blocked.propertyId === propertyId && this.overlaps(startDate, endDate, blocked.startDate, blocked.endDate))) {
      throw new Error('Dates are already blocked');
    }
    this.blockedDates.push({ propertyId, startDate, endDate });
  }

  isAvailable(propertyId: string, startDate: string, endDate: string): boolean {
    this.validateDateRange(startDate, endDate);
    return !this.blockedDates.some((blocked) => blocked.propertyId === propertyId && this.overlaps(startDate, endDate, blocked.startDate, blocked.endDate));
  }

  getWhatsAppMessageUrl(phone: string, message: string): string {
    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    if (!normalizedPhone || !message.trim()) throw new Error('Phone number and message are required');
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  }

  createCleaningTask(propertyId: string, roomId: string, checkoutAt: string, cleanerId?: string): CleaningTask {
    const task: CleaningTask = { id: `cleaning-${++this.taskSequence}`, propertyId, roomId, checkoutAt, status: 'assigned', cleanerId };
    this.cleaningTasks.push(task);
    return task;
  }

  generateAccessCode(): string {
    return String(randomInt(100000, 1000000));
  }

  verifyGuestAndRecordDeposit(guestId: string, verified: boolean, depositMinor: number): { guestId: string; verified: boolean; depositMinor: number } {
    if (!guestId.trim() || depositMinor < 0 || !Number.isSafeInteger(depositMinor)) throw new Error('Guest and valid deposit are required');
    if (!verified) throw new Error('Guest ID verification failed');
    return { guestId, verified, depositMinor };
  }

  requestReview(review: Omit<ReviewRecord, 'id' | 'reviewRequested'>): ReviewRecord {
    const record = { ...review, id: `review-${++this.reviewSequence}`, reviewRequested: true };
    this.reviews.push(record);
    return record;
  }

  replyToReview(reviewId: string, response: string): ReviewRecord {
    const review = this.reviews.find((candidate) => candidate.id === reviewId);
    if (!review) throw new Error(`Review ${reviewId} was not found`);
    review.response = response;
    return review;
  }

  recordBookingAnalytics(record: BookingAnalytics): void {
    this.analytics.push({ ...record });
    if (this.analyticsInitialized) {
      this.analyticsPersistence = this.analyticsPersistence.then(() => this.analyticsStore.save([...this.analytics]));
      void this.analyticsPersistence.catch((error: unknown) => console.error('Failed to persist reporting data:', error));
    }
  }

  getAnalytics(propertyId?: string): { revenueMinor: number; occupancyPercent: number; bestPlatform: string | null } {
    const records = propertyId ? this.analytics.filter((record) => record.propertyId === propertyId) : this.analytics;
    const revenueMinor = records.reduce((sum, record) => sum + record.revenueMinor, 0);
    const nights = records.reduce((sum, record) => sum + record.nights, 0);
    const byPlatform = new Map<string, number>();
    records.forEach((record) => byPlatform.set(record.platform, (byPlatform.get(record.platform) ?? 0) + record.revenueMinor));
    const bestPlatform = Array.from(byPlatform.entries()).sort((first, second) => second[1] - first[1])[0]?.[0] ?? null;
    return { revenueMinor, occupancyPercent: Math.min(nights / 30 * 100, 100), bestPlatform };
  }

  createPromoCode(code: string, discountPercent: number): void {
    if (!code.trim() || discountPercent <= 0 || discountPercent > 100) throw new Error('Promo code and valid discount are required');
    this.promoCodes.set(code.toUpperCase(), discountPercent);
  }

  getPromoDiscount(code: string): number {
    return this.promoCodes.get(code.toUpperCase()) ?? 0;
  }

  addProperty(property: OwnerProperty): OwnerProperty[] {
    if (!property.ownerId.trim() || !property.id.trim()) throw new Error('Property and owner are required');
    this.properties.set(property.id, property);
    return this.getProperties(property.ownerId);
  }

  getProperties(ownerId: string): OwnerProperty[] {
    return Array.from(this.properties.values()).filter((property) => property.ownerId === ownerId);
  }

  private validateDateRange(startDate: string, endDate: string): void {
    if (Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate)) || Date.parse(endDate) <= Date.parse(startDate)) throw new Error('Invalid date range');
  }

  private overlaps(firstStart: string, firstEnd: string, secondStart: string, secondEnd: string): boolean {
    return Date.parse(firstStart) < Date.parse(secondEnd) && Date.parse(secondStart) < Date.parse(firstEnd);
  }
}

export default new OwnerManagementService();
