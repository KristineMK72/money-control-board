export type SpendEntry = {
  id: string;
  date: string; // ISO
  amount: number;
  category: SpendCategory;
  note?: string;
};

export type SpendCategory =
  | "groceries"
  | "gas"
  | "eating_out"
  | "kids"
  | "business"
  | "self_care"
  | "misc";
