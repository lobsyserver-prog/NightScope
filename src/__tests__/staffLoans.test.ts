import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonFileStore } from '../services/persistence';
import { StaffLoanService } from '../services/staffLoans';

describe('StaffLoanService', () => {
  it('creates a staff loan and applies scheduled payroll deductions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nightscope-loans-'));
    try {
      const service = new StaffLoanService(new JsonFileStore(join(directory, 'loans.json')));
      const loan = await service.createLoan('owner', 'owner-1', 'staff-1', 120000, 30000, 'zar', 'Emergency support');
      const deduction = await service.applyPayrollDeduction('staff-1', 10000, 'payroll-2026-09');

      expect(loan).toMatchObject({ principalMinor: 120000, outstandingMinor: 120000, currency: 'ZAR', status: 'active' });
      expect(deduction).toMatchObject({ regularDeductionsMinor: 10000, loanDeductionsMinor: 30000, totalDeductionsMinor: 40000 });
      expect((await service.getLoansForStaff('staff-1'))[0].outstandingMinor).toBe(90000);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('persists loans so a new service instance can reload them', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nightscope-loans-'));
    const filePath = join(directory, 'loans.json');
    try {
      const firstService = new StaffLoanService(new JsonFileStore(filePath));
      await firstService.createLoan('admin', 'admin-1', 'staff-1', 50000, 10000);
      const secondService = new StaffLoanService(new JsonFileStore(filePath));

      expect((await secondService.getLoansForStaff('staff-1'))).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('restricts issuing loans to management and validates deduction amounts', async () => {
    const service = new StaffLoanService(new JsonFileStore('/tmp/nightscope-loans-invalid.json'));

    await expect(service.createLoan('staff' as 'owner', 'staff-1', 'staff-2', 10000, 1000)).rejects.toThrow('Only owners');
    await expect(service.createLoan('owner', 'owner-1', 'staff-1', 10000, 20000)).rejects.toThrow('valid monthly deduction');
  });
});
