import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(), recipient: text('recipient').notNull(),
  amount: text('amount').notNull(), note: text('note').notNull(),
  createdAt: integer('created_at').notNull(), data: text('data').notNull(),
  txHash: text('tx_hash').unique(), payer: text('payer'), blockNumber: text('block_number'),
  paidAt: integer('paid_at'), fee: text('fee'),
  startBlock: text('start_block'), scanBlock: text('scan_block'), scanCheckedAt: integer('scan_checked_at'),
});
