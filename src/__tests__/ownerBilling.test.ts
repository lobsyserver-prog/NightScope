import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonFileStore } from '../services/persistence';
import { OwnerBillingService } from '../services/ownerBilling';

describe('OwnerBillingService', () => {
  it('creates and prints a quote with calculated totals', () => {
    const service = new OwnerBillingService();
    const quote = service.createQuote('owner-1', 'Guest One', [
      { description: 'Room booking', quantity: 2, unitPriceMinor: 150000 },
      { description: 'Breakfast', quantity: 2, unitPriceMinor: 15000 },
    ], 'zar', 15);

    expect(quote).toMatchObject({ subtotalMinor: 330000, taxMinor: 49500, totalMinor: 379500, status: 'draft', currency: 'ZAR' });
    expect(service.printQuote('owner-1', quote.id)).toContain('SCOPEBRIDGE QUOTE');
  });

  it('converts an accepted quote to an invoice and records payment', () => {
    const service = new OwnerBillingService();
    const quote = service.createQuote('owner-1', 'Guest One', [{ description: 'Stay', quantity: 1, unitPriceMinor: 200000 }]);
    service.markQuoteSent('owner-1', quote.id);
    service.acceptQuote('owner-1', quote.id);
    const invoice = service.createInvoiceFromQuote('owner-1', quote.id);

    expect(invoice).toMatchObject({ quoteId: quote.id, status: 'issued', totalMinor: 200000 });
    expect(service.markInvoicePaid('owner-1', invoice.id).status).toBe('paid');
    expect(service.printInvoice('owner-1', invoice.id)).toContain('Status: paid');
  });

  it('restricts documents to their owner and validates line items', () => {
    const service = new OwnerBillingService();
    expect(() => service.createInvoice('owner-1', 'Guest', [{ description: 'Stay', quantity: 0, unitPriceMinor: 1000 }])).toThrow('Line items');
    const quote = service.createQuote('owner-1', 'Guest', [{ description: 'Stay', quantity: 1, unitPriceMinor: 1000 }]);
    expect(() => service.printQuote('other-owner', quote.id)).toThrow('Only the quote owner');
    expect(() => service.createInvoiceFromQuote('owner-1', quote.id)).toThrow('accepted quote');
  });

  it('saves quote and invoice PDFs to disk and exposes valid PDF content', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'scopebridge-billing-'));
    try {
      const filePath = join(tempDir, 'billing.json');
      const service = new OwnerBillingService(new JsonFileStore(filePath));
      const quote = service.createQuote('owner-1', 'Guest One', [{ description: 'Stay', quantity: 1, unitPriceMinor: 200000 }], 'zar', 15);
      const quotePdf = service.saveQuotePdf('owner-1', quote.id, join(tempDir, 'quote.pdf'));
      expect(quotePdf).toContain('%PDF');
      const invoice = service.createInvoice('owner-1', 'Guest One', [{ description: 'Stay', quantity: 1, unitPriceMinor: 200000 }], 'zar', 15);
      const invoicePdf = service.saveInvoicePdf('owner-1', invoice.id, join(tempDir, 'invoice.pdf'));
      expect(invoicePdf).toContain('%PDF');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
