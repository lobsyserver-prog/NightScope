import { writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { JsonFileStore } from './persistence';

export interface BillingLineItem {
  description: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface Quote {
  id: string;
  ownerId: string;
  customerName: string;
  customerEmail?: string;
  currency: string;
  items: BillingLineItem[];
  subtotalMinor: number;
  taxPercent: number;
  taxMinor: number;
  totalMinor: number;
  status: 'draft' | 'sent' | 'accepted' | 'converted';
  createdAt: string;
}

export interface Invoice {
  id: string;
  ownerId: string;
  quoteId?: string;
  customerName: string;
  customerEmail?: string;
  currency: string;
  items: BillingLineItem[];
  subtotalMinor: number;
  taxPercent: number;
  taxMinor: number;
  totalMinor: number;
  status: 'issued' | 'paid' | 'void';
  createdAt: string;
  paidAt?: string;
}

export class OwnerBillingService {
  private readonly quotes = new Map<string, Quote>();
  private readonly invoices = new Map<string, Invoice>();
  private quoteSequence = 0;
  private invoiceSequence = 0;
  private readonly store?: JsonFileStore<{ quotes: Quote[]; invoices: Invoice[] }>;

  constructor(store?: JsonFileStore<{ quotes: Quote[]; invoices: Invoice[] }>) {
    this.store = store;
    if (this.store) {
      const persisted = this.store.loadSync({ quotes: [], invoices: [] });
      for (const quote of persisted.quotes) this.quotes.set(quote.id, quote);
      for (const invoice of persisted.invoices) this.invoices.set(invoice.id, invoice);
      this.quoteSequence = Math.max(this.quoteSequence, ...Array.from(this.quotes.keys()).map((id) => Number(id.replace('quote-', ''))));
      this.invoiceSequence = Math.max(this.invoiceSequence, ...Array.from(this.invoices.keys()).map((id) => Number(id.replace('invoice-', ''))));
    }
  }

  createQuote(
    ownerId: string,
    customerName: string,
    items: BillingLineItem[],
    currency = 'ZAR',
    taxPercent = 0,
    customerEmail?: string
  ): Quote {
    this.validateDocumentInput(ownerId, customerName, items, taxPercent);
    const totals = this.calculateTotals(items, taxPercent);
    const quote: Quote = {
      id: `quote-${++this.quoteSequence}`,
      ownerId,
      customerName,
      customerEmail,
      currency: currency.toUpperCase(),
      items: items.map((item) => ({ ...item })),
      ...totals,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    this.quotes.set(quote.id, quote);
    this.persist();
    return quote;
  }

  markQuoteSent(ownerId: string, quoteId: string): Quote {
    const quote = this.requireQuote(ownerId, quoteId);
    quote.status = 'sent';
    this.persist();
    return quote;
  }

  acceptQuote(ownerId: string, quoteId: string): Quote {
    const quote = this.requireQuote(ownerId, quoteId);
    quote.status = 'accepted';
    this.persist();
    return quote;
  }

  createInvoice(
    ownerId: string,
    customerName: string,
    items: BillingLineItem[],
    currency = 'ZAR',
    taxPercent = 0,
    customerEmail?: string
  ): Invoice {
    this.validateDocumentInput(ownerId, customerName, items, taxPercent);
    return this.storeInvoice(ownerId, customerName, items, currency, taxPercent, customerEmail);
  }

  createInvoiceFromQuote(ownerId: string, quoteId: string): Invoice {
    const quote = this.requireQuote(ownerId, quoteId);
    if (quote.status !== 'accepted') throw new Error('Only an accepted quote can become an invoice');
    const invoice = this.storeInvoice(ownerId, quote.customerName, quote.items, quote.currency, quote.taxPercent, quote.customerEmail, quote.id);
    quote.status = 'converted';
    return invoice;
  }

  markInvoicePaid(ownerId: string, invoiceId: string): Invoice {
    const invoice = this.requireInvoice(ownerId, invoiceId);
    if (invoice.status === 'void') throw new Error('A void invoice cannot be paid');
    invoice.status = 'paid';
    invoice.paidAt = new Date().toISOString();
    this.persist();
    return invoice;
  }

  voidInvoice(ownerId: string, invoiceId: string): Invoice {
    const invoice = this.requireInvoice(ownerId, invoiceId);
    invoice.status = 'void';
    this.persist();
    return invoice;
  }

  printQuote(ownerId: string, quoteId: string): string {
    return this.formatDocument(this.requireQuote(ownerId, quoteId));
  }

  printInvoice(ownerId: string, invoiceId: string): string {
    return this.formatDocument(this.requireInvoice(ownerId, invoiceId));
  }

  saveQuotePdf(ownerId: string, quoteId: string, filePath: string): string {
    const quote = this.requireQuote(ownerId, quoteId);
    const content = this.formatDocument(quote);
    const pdf = this.createPdfDocument(`SCOPEBRIDGE QUOTE ${quote.id}`, content);
    this.writePdf(filePath, pdf);
    return pdf;
  }

  saveInvoicePdf(ownerId: string, invoiceId: string, filePath: string): string {
    const invoice = this.requireInvoice(ownerId, invoiceId);
    const content = this.formatDocument(invoice);
    const pdf = this.createPdfDocument(`SCOPEBRIDGE INVOICE ${invoice.id}`, content);
    this.writePdf(filePath, pdf);
    return pdf;
  }

  private storeInvoice(ownerId: string, customerName: string, items: BillingLineItem[], currency: string, taxPercent: number, customerEmail?: string, quoteId?: string): Invoice {
    const totals = this.calculateTotals(items, taxPercent);
    const invoice: Invoice = {
      id: `invoice-${++this.invoiceSequence}`,
      ownerId,
      quoteId,
      customerName,
      customerEmail,
      currency: currency.toUpperCase(),
      items: items.map((item) => ({ ...item })),
      ...totals,
      status: 'issued',
      createdAt: new Date().toISOString(),
    };
    this.invoices.set(invoice.id, invoice);
    this.persist();
    return invoice;
  }

  private calculateTotals(items: BillingLineItem[], taxPercent: number): Pick<Quote, 'subtotalMinor' | 'taxPercent' | 'taxMinor' | 'totalMinor'> {
    const subtotalMinor = items.reduce((total, item) => total + item.quantity * item.unitPriceMinor, 0);
    const taxMinor = Math.round(subtotalMinor * taxPercent / 100);
    return { subtotalMinor, taxPercent, taxMinor, totalMinor: subtotalMinor + taxMinor };
  }

  private validateDocumentInput(ownerId: string, customerName: string, items: BillingLineItem[], taxPercent: number): void {
    if (!ownerId.trim() || !customerName.trim() || items.length === 0) throw new Error('Owner, customer, and at least one line item are required');
    if (taxPercent < 0 || taxPercent > 100) throw new Error('Tax percentage must be between 0 and 100');
    if (items.some((item) => !item.description.trim() || item.quantity <= 0 || !Number.isInteger(item.quantity) || item.unitPriceMinor <= 0 || !Number.isSafeInteger(item.unitPriceMinor))) {
      throw new Error('Line items require a description, positive integer quantity, and positive price');
    }
  }

  private requireQuote(ownerId: string, quoteId: string): Quote {
    const quote = this.quotes.get(quoteId);
    if (!quote) throw new Error(`Quote ${quoteId} was not found`);
    if (quote.ownerId !== ownerId) throw new Error('Only the quote owner can manage this quote');
    return quote;
  }

  private requireInvoice(ownerId: string, invoiceId: string): Invoice {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) throw new Error(`Invoice ${invoiceId} was not found`);
    if (invoice.ownerId !== ownerId) throw new Error('Only the invoice owner can manage this invoice');
    return invoice;
  }

  private formatDocument(document: Quote | Invoice): string {
    const type = document.id.startsWith('quote-') ? 'QUOTE' : 'INVOICE';
    const lines = document.items.map((item) => `${item.description} | ${item.quantity} x ${item.unitPriceMinor} = ${item.quantity * item.unitPriceMinor}`);
    return [
      `SCOPEBRIDGE ${type} ${document.id}`,
      `Customer: ${document.customerName}`,
      `Currency: ${document.currency}`,
      ...lines,
      `Subtotal: ${document.subtotalMinor}`,
      `Tax (${document.taxPercent}%): ${document.taxMinor}`,
      `Total: ${document.totalMinor}`,
      `Status: ${document.status}`,
    ].join('\n');
  }

  private persist(): void {
    if (!this.store) return;
    this.store.saveSync({
      quotes: Array.from(this.quotes.values()),
      invoices: Array.from(this.invoices.values()),
    });
  }

  private writePdf(filePath: string, contents: string): void {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, 'utf8');
  }

  private createPdfDocument(title: string, body: string): string {
    const escapedBody = body
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r?\n/g, ') Tj\nBT /F1 10 Tf 50 750 Td (');

    const stream = `BT /F1 18 Tf 50 780 Td (${title}) Tj\n50 760 Td (${escapedBody}) Tj\nET`;
    const content = Buffer.byteLength(stream, 'utf8');
    return `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${content} >>\nstream\n${stream}\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n${Array.from({ length: 5 }, (_, index) => '').join('\n')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n0\n%%EOF`;
  }
}

export default new OwnerBillingService();
