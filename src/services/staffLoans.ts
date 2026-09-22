import { JsonFileStore } from './persistence';

export interface LoanDeduction {
  amountMinor: number;
  appliedAt: string;
  payrollReference?: string;
}

export interface StaffLoan {
  id: string;
  staffId: string;
  issuedBy: string;
  principalMinor: number;
  outstandingMinor: number;
  monthlyDeductionMinor: number;
  currency: string;
  reason?: string;
  status: 'active' | 'paid';
  deductions: LoanDeduction[];
  createdAt: string;
}

export interface PayrollDeductionSummary {
  staffId: string;
  regularDeductionsMinor: number;
  loanDeductionsMinor: number;
  totalDeductionsMinor: number;
}

export class StaffLoanService {
  private loans: StaffLoan[] = [];
  private initialized = false;
  private sequence = 0;

  constructor(private readonly store = new JsonFileStore<StaffLoan[]>(process.env.SCOPEBRIDGE_LOANS_FILE ?? './data/staff-loans.json')) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.loans = await this.store.load([]);
    this.sequence = this.loans.reduce((highest, loan) => {
      const number = Number(loan.id.replace('staff-loan-', ''));
      return Number.isFinite(number) ? Math.max(highest, number) : highest;
    }, 0);
    this.initialized = true;
  }

  async createLoan(
    role: 'owner' | 'admin',
    issuedBy: string,
    staffId: string,
    principalMinor: number,
    monthlyDeductionMinor: number,
    currency = 'ZAR',
    reason?: string
  ): Promise<StaffLoan> {
    this.requireManagementRole(role);
    await this.initialize();
    if (!issuedBy.trim() || !staffId.trim() || principalMinor <= 0 || monthlyDeductionMinor <= 0 || monthlyDeductionMinor > principalMinor) {
      throw new Error('Loan issuer, staff ID, principal, and valid monthly deduction are required');
    }

    const loan: StaffLoan = {
      id: `staff-loan-${++this.sequence}`,
      staffId,
      issuedBy,
      principalMinor,
      outstandingMinor: principalMinor,
      monthlyDeductionMinor,
      currency: currency.toUpperCase(),
      reason,
      status: 'active',
      deductions: [],
      createdAt: new Date().toISOString(),
    };
    this.loans.push(loan);
    await this.store.save(this.loans);
    return this.copyLoan(loan);
  }

  async getLoansForStaff(staffId: string): Promise<StaffLoan[]> {
    await this.initialize();
    return this.loans.filter((loan) => loan.staffId === staffId).map((loan) => this.copyLoan(loan));
  }

  async applyPayrollDeduction(staffId: string, regularDeductionsMinor: number, payrollReference?: string): Promise<PayrollDeductionSummary> {
    await this.initialize();
    if (!Number.isSafeInteger(regularDeductionsMinor) || regularDeductionsMinor < 0) throw new Error('Regular deductions must be a valid non-negative amount');

    const activeLoans = this.loans.filter((loan) => loan.staffId === staffId && loan.status === 'active');
    const loanDeductionsMinor = activeLoans.reduce((total, loan) => {
      const deduction = Math.min(loan.monthlyDeductionMinor, loan.outstandingMinor);
      loan.outstandingMinor -= deduction;
      loan.deductions.push({ amountMinor: deduction, appliedAt: new Date().toISOString(), payrollReference });
      if (loan.outstandingMinor === 0) loan.status = 'paid';
      return total + deduction;
    }, 0);
    await this.store.save(this.loans);
    return { staffId, regularDeductionsMinor, loanDeductionsMinor, totalDeductionsMinor: regularDeductionsMinor + loanDeductionsMinor };
  }

  async getPayrollDeductionSummary(staffId: string): Promise<PayrollDeductionSummary> {
    await this.initialize();
    const loanDeductionsMinor = this.loans
      .filter((loan) => loan.staffId === staffId && loan.status === 'active')
      .reduce((total, loan) => total + Math.min(loan.monthlyDeductionMinor, loan.outstandingMinor), 0);
    return { staffId, regularDeductionsMinor: 0, loanDeductionsMinor, totalDeductionsMinor: loanDeductionsMinor };
  }

  private requireManagementRole(role: 'owner' | 'admin'): void {
    if (role !== 'owner' && role !== 'admin') throw new Error('Only owners or admins can issue staff loans');
  }

  private copyLoan(loan: StaffLoan): StaffLoan {
    return { ...loan, deductions: loan.deductions.map((deduction) => ({ ...deduction })) };
  }
}

export default new StaffLoanService();
