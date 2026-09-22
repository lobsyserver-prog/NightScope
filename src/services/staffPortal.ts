import { randomUUID } from 'node:crypto';

export interface CheckInQrCode {
  id: string;
  propertyId: string;
  token: string;
  qrCodeUrl: string;
  expiresAt: string;
  status: 'active' | 'revoked';
}

export interface StaffMember {
  id: string;
  ownerId: string;
  fullName: string;
  email: string;
  isActive: boolean;
}

export interface Payslip {
  id: string;
  staffId: string;
  payPeriod: string;
  grossMinor: number;
  deductionsMinor: number;
  netMinor: number;
  currency: string;
  issuedAt: string;
}

export interface LeaveRequest {
  id: string;
  staffId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
}

export interface WellnessProgram {
  id: string;
  name: string;
  description: string;
  providerUrl?: string;
  isActive: boolean;
}

export class StaffPortalService {
  private readonly qrCodes = new Map<string, CheckInQrCode>();
  private readonly staff = new Map<string, StaffMember>();
  private readonly payslips = new Map<string, Payslip>();
  private readonly leaveRequests = new Map<string, LeaveRequest>();
  private readonly wellnessPrograms = new Map<string, WellnessProgram>();
  private readonly wellnessEnrollments = new Set<string>();

  createCheckInQr(role: 'owner' | 'admin', propertyId: string, expiresAt: string): CheckInQrCode {
    this.requireManagementRole(role);
    if (!propertyId.trim() || Number.isNaN(Date.parse(expiresAt))) throw new Error('Property and valid expiry are required');
    const token = randomUUID();
    const qr: CheckInQrCode = {
      id: `check-in-qr-${randomUUID().slice(0, 8)}`,
      propertyId,
      token,
      qrCodeUrl: `https://quickchart.io/qr?text=${encodeURIComponent(`scopebridge://check-in/${token}`)}&size=300`,
      expiresAt,
      status: 'active',
    };
    this.qrCodes.set(qr.id, qr);
    return qr;
  }

  checkInWithQr(token: string, guestId: string, now = new Date()): { guestId: string; propertyId: string; checkedInAt: string } {
    const qr = Array.from(this.qrCodes.values()).find((candidate) => candidate.token === token);
    if (!qr || qr.status !== 'active') throw new Error('Check-in QR code is invalid or revoked');
    if (Date.parse(qr.expiresAt) <= now.getTime()) throw new Error('Check-in QR code has expired');
    if (!guestId.trim()) throw new Error('Guest ID is required');
    return { guestId, propertyId: qr.propertyId, checkedInAt: now.toISOString() };
  }

  revokeCheckInQr(role: 'owner' | 'admin', qrId: string): CheckInQrCode {
    this.requireManagementRole(role);
    const qr = this.qrCodes.get(qrId);
    if (!qr) throw new Error(`Check-in QR ${qrId} was not found`);
    qr.status = 'revoked';
    return qr;
  }

  registerStaff(ownerId: string, input: Omit<StaffMember, 'ownerId' | 'isActive'>): StaffMember {
    if (!ownerId.trim() || !input.id.trim() || !input.fullName.trim() || !input.email.trim()) throw new Error('Owner, staff ID, name, and email are required');
    const member = { ...input, ownerId, isActive: true };
    this.staff.set(member.id, member);
    return member;
  }

  addPayslip(role: 'owner' | 'admin', input: Omit<Payslip, 'id' | 'issuedAt'>): Payslip {
    this.requireManagementRole(role);
    this.requireStaff(input.staffId);
    if (input.grossMinor < 0 || input.deductionsMinor < 0 || input.netMinor !== input.grossMinor - input.deductionsMinor) throw new Error('Payslip amounts are invalid');
    const payslip: Payslip = { ...input, id: `payslip-${randomUUID().slice(0, 8)}`, issuedAt: new Date().toISOString(), currency: input.currency.toUpperCase() };
    this.payslips.set(payslip.id, payslip);
    return payslip;
  }

  getStaffPayslips(staffId: string): Payslip[] {
    this.requireStaff(staffId);
    return Array.from(this.payslips.values()).filter((payslip) => payslip.staffId === staffId).map((payslip) => ({ ...payslip }));
  }

  requestLeave(staffId: string, startDate: string, endDate: string, reason: string): LeaveRequest {
    this.requireStaff(staffId);
    if (Number.isNaN(Date.parse(startDate)) || Number.isNaN(Date.parse(endDate)) || Date.parse(endDate) < Date.parse(startDate) || !reason.trim()) throw new Error('Leave dates and reason are required');
    const request: LeaveRequest = { id: `leave-${randomUUID().slice(0, 8)}`, staffId, startDate, endDate, reason, status: 'pending', createdAt: new Date().toISOString() };
    this.leaveRequests.set(request.id, request);
    return request;
  }

  decideLeave(role: 'owner' | 'admin', leaveId: string, approved: boolean): LeaveRequest {
    this.requireManagementRole(role);
    const request = this.leaveRequests.get(leaveId);
    if (!request) throw new Error(`Leave request ${leaveId} was not found`);
    request.status = approved ? 'approved' : 'declined';
    return request;
  }

  addWellnessProgram(role: 'owner' | 'admin', program: WellnessProgram): WellnessProgram {
    this.requireManagementRole(role);
    if (!program.id.trim() || !program.name.trim()) throw new Error('Wellness program ID and name are required');
    this.wellnessPrograms.set(program.id, { ...program });
    return program;
  }

  getWellnessPrograms(): WellnessProgram[] {
    return Array.from(this.wellnessPrograms.values()).filter((program) => program.isActive).map((program) => ({ ...program }));
  }

  enrollInWellness(staffId: string, programId: string): void {
    this.requireStaff(staffId);
    const program = this.wellnessPrograms.get(programId);
    if (!program || !program.isActive) throw new Error(`Wellness program ${programId} is not available`);
    this.wellnessEnrollments.add(`${staffId}:${programId}`);
  }

  private requireStaff(staffId: string): StaffMember {
    const member = this.staff.get(staffId);
    if (!member || !member.isActive) throw new Error(`Staff member ${staffId} was not found or is inactive`);
    return member;
  }

  private requireManagementRole(role: 'owner' | 'admin'): void {
    if (role !== 'owner' && role !== 'admin') throw new Error('Only owners or admins can manage staff portal records');
  }
}

export default new StaffPortalService();
