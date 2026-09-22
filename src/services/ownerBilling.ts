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
    return quote;
  }

  markQuoteSent(ownerId: string, quoteId: string): Quote {
    const quote = this.requireQuote(ownerId, quoteId);
    quote.status = 'sent';
    return quote;
  }

  acceptQuote(ownerId: string, quoteId: string): Quote {
    const quote = this.requireQuote(ownerId, quoteId);
    quote.status = 'accepted';
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
    return invoice;
  }

  voidInvoice(ownerId: string, invoiceId: string): Invoice {
    const invoice = this.requireInvoice(ownerId, invoiceId);
    invoice.status = 'void';
    return invoice;
  }

  printQuote(ownerId: string, quoteId: string): string {
    return this.formatDocument(this.requireQuote(ownerId, quoteId));
  }

  printInvoice(ownerId: string, invoiceId: string): string {
    return this.formatDocument(this.requireInvoice(ownerId, invoiceId));
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
}

export default new OwnerBillingService();
