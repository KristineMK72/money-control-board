export type BucketKey = string;

export type BucketKind = "bill" | "credit" | "loan";

export type Bucket = {
  key: BucketKey;
  name: string;

  target: number;   // current target (monthly target if monthly)
  saved: number;    // derived from allocations (source of truth)

  due?: string;     // human note
  dueDate?: string; // YYYY-MM-DD (for planning)
  priority: 1 | 2 | 3;
  focus?: boolean;

  kind: BucketKind;

  // debt fields
  balance?: number;
  apr?: number;
  minPayment?: number;
  creditLimit?: number;

  // monthly automation
  isMonthly?: boolean;
  monthlyTarget?: number;
  dueDay?: number; // 1-31
};

export type EntrySource = "Salon" | "DoorDash" | "Other";

export type Entry = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  source: EntrySource;
  amount: number;
  note?: string;
  allocations: Partial<Record<BucketKey, number>>;
};

export type StorageShape = {
  buckets: Bucket[];
  entries: Entry[];
  meta?: { lastMonthlyApplied?: string };
};
