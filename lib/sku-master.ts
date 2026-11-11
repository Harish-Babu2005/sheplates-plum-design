// ShePlates Category-Wise SKU Master
// Authoritative source of truth for categories, product groups, pack sizes and unit types.

export type SkuUnitType =
  | "ml"
  | "L"
  | "g"
  | "kg"
  | "pcs"
  | "portion"
  | "persons"
  | "bunch"
  | "pack/set/loaf";

export const SKU_UNIT_TYPES: readonly SkuUnitType[] = [
  "ml",
  "L",
  "g",
  "kg",
  "pcs",
  "portion",
  "persons",
  "bunch",
  "pack/set/loaf",
] as const;

export interface SkuRecord {
  category: string;
  group: string;
  packSize: string;
  unitType: SkuUnitType;
  displayOrder: number;
  active: boolean;
}

export const SKU_CATEGORIES: readonly string[] = [
  "Milk & dairy",
  "Home food",
  "Caterer",
  "Meat & fish",
  "Vegetables",
  "Groceries",
  "Eggs",
  "Bakery",
  "Snacks",
  "Rice & staples",
  "Other"
] as const;

export const SKU_MASTER_RECORDS: readonly SkuRecord[] = [
  {
    "category": "Milk & dairy",
    "group": "Milk",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk",
    "packSize": "1.5 L",
    "unitType": "L",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk",
    "packSize": "2 L",
    "unitType": "L",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk",
    "packSize": "5 L",
    "unitType": "L",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Flavoured milk",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Flavoured milk",
    "packSize": "150 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Flavoured milk",
    "packSize": "180 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Flavoured milk",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Flavoured milk",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Flavoured milk",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Flavoured milk",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Curd",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Curd",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Curd",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Curd",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Curd",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Curd",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Curd",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Curd",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Greek yogurt",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Greek yogurt",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Greek yogurt",
    "packSize": "150 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Greek yogurt",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Greek yogurt",
    "packSize": "400 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Greek yogurt",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Greek yogurt",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Buttermilk",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Buttermilk",
    "packSize": "150 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Buttermilk",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Buttermilk",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Buttermilk",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Buttermilk",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Buttermilk",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Lassi",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Lassi",
    "packSize": "150 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Lassi",
    "packSize": "180 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Lassi",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Lassi",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Lassi",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Lassi",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Paneer",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Paneer",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Paneer",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Paneer",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Paneer",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Paneer",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Paneer",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Butter",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Butter",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Butter",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Butter",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Butter",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Butter",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Butter",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Butter",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "10 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "20 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Ghee",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese slices",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese slices",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese slices",
    "packSize": "5 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese slices",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese slices",
    "packSize": "20 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese block",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese block",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese block",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese block",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese block",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cheese block",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cream",
    "packSize": "10 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cream",
    "packSize": "20 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cream",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cream",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cream",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cream",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cream",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Cream",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk powder",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk powder",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk powder",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk powder",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk powder",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Milk & dairy",
    "group": "Milk powder",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Idli",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Idli",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Idli",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Idli",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Idli",
    "packSize": "8 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Idli",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Idli",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Dosa",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Dosa",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Dosa",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Dosa",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Dosa",
    "packSize": "5 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Dosa",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chapati",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chapati",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chapati",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chapati",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chapati",
    "packSize": "8 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chapati",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chapati",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Parotta",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Parotta",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Parotta",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Parotta",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Parotta",
    "packSize": "5 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Parotta",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Poori",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Poori",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Poori",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Poori",
    "packSize": "8 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Poori",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Pongal",
    "packSize": "150 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Pongal",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Pongal",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Pongal",
    "packSize": "300 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Pongal",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Pongal",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Pongal",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Upma",
    "packSize": "150 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Upma",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Upma",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Upma",
    "packSize": "300 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Upma",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Upma",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Upma",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Variety rice",
    "packSize": "150 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Variety rice",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Variety rice",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Variety rice",
    "packSize": "300 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Variety rice",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Variety rice",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Variety rice",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Meals",
    "packSize": "Half portion",
    "unitType": "portion",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Meals",
    "packSize": "Full portion",
    "unitType": "portion",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Meals",
    "packSize": "Family pack (2 persons)",
    "unitType": "persons",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Meals",
    "packSize": "Family pack (4 persons)",
    "unitType": "persons",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Biryani",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Biryani",
    "packSize": "350 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Biryani",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Biryani",
    "packSize": "650 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Biryani",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Biryani",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Biryani",
    "packSize": "1.5 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Biryani",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "30 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "150 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Curry / gravy",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chutney",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chutney",
    "packSize": "30 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chutney",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chutney",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chutney",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chutney",
    "packSize": "150 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chutney",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Chutney",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Sambar",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Sambar",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Sambar",
    "packSize": "150 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Sambar",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Sambar",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Sambar",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Sambar",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Sambar",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Combo meal",
    "packSize": "Single serving",
    "unitType": "portion",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Combo meal",
    "packSize": "2-person combo",
    "unitType": "persons",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Combo meal",
    "packSize": "3-person combo",
    "unitType": "persons",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Combo meal",
    "packSize": "4-person combo",
    "unitType": "persons",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Home food",
    "group": "Combo meal",
    "packSize": "Family combo (5 persons)",
    "unitType": "persons",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Breakfast package",
    "packSize": "1 person",
    "unitType": "persons",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Breakfast package",
    "packSize": "5 persons",
    "unitType": "persons",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Breakfast package",
    "packSize": "10 persons",
    "unitType": "persons",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Breakfast package",
    "packSize": "15 persons",
    "unitType": "persons",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Breakfast package",
    "packSize": "20 persons",
    "unitType": "persons",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Breakfast package",
    "packSize": "25 persons",
    "unitType": "persons",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Breakfast package",
    "packSize": "50 persons",
    "unitType": "persons",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Breakfast package",
    "packSize": "100 persons",
    "unitType": "persons",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Lunch package",
    "packSize": "1 person",
    "unitType": "persons",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Lunch package",
    "packSize": "5 persons",
    "unitType": "persons",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Lunch package",
    "packSize": "10 persons",
    "unitType": "persons",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Lunch package",
    "packSize": "15 persons",
    "unitType": "persons",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Lunch package",
    "packSize": "20 persons",
    "unitType": "persons",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Lunch package",
    "packSize": "25 persons",
    "unitType": "persons",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Lunch package",
    "packSize": "50 persons",
    "unitType": "persons",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Lunch package",
    "packSize": "100 persons",
    "unitType": "persons",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Dinner package",
    "packSize": "1 person",
    "unitType": "persons",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Dinner package",
    "packSize": "5 persons",
    "unitType": "persons",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Dinner package",
    "packSize": "10 persons",
    "unitType": "persons",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Dinner package",
    "packSize": "15 persons",
    "unitType": "persons",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Dinner package",
    "packSize": "20 persons",
    "unitType": "persons",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Dinner package",
    "packSize": "25 persons",
    "unitType": "persons",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Dinner package",
    "packSize": "50 persons",
    "unitType": "persons",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Dinner package",
    "packSize": "100 persons",
    "unitType": "persons",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Biryani bulk",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Biryani bulk",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Biryani bulk",
    "packSize": "3 kg",
    "unitType": "kg",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Biryani bulk",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Biryani bulk",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Biryani bulk",
    "packSize": "15 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Biryani bulk",
    "packSize": "20 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Rice bulk",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Rice bulk",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Rice bulk",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Rice bulk",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Rice bulk",
    "packSize": "15 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Rice bulk",
    "packSize": "20 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Snacks platter",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Snacks platter",
    "packSize": "20 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Snacks platter",
    "packSize": "25 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Snacks platter",
    "packSize": "50 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Snacks platter",
    "packSize": "100 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Snacks platter",
    "packSize": "200 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Sweets bulk",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Sweets bulk",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Sweets bulk",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Sweets bulk",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Sweets bulk",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Sweets bulk",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Beverage dispenser",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Beverage dispenser",
    "packSize": "2 L",
    "unitType": "L",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Beverage dispenser",
    "packSize": "5 L",
    "unitType": "L",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Beverage dispenser",
    "packSize": "10 L",
    "unitType": "L",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Beverage dispenser",
    "packSize": "15 L",
    "unitType": "L",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Beverage dispenser",
    "packSize": "20 L",
    "unitType": "L",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Event package",
    "packSize": "10 persons",
    "unitType": "persons",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Event package",
    "packSize": "20 persons",
    "unitType": "persons",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Event package",
    "packSize": "25 persons",
    "unitType": "persons",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Event package",
    "packSize": "50 persons",
    "unitType": "persons",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Event package",
    "packSize": "75 persons",
    "unitType": "persons",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Event package",
    "packSize": "100 persons",
    "unitType": "persons",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Event package",
    "packSize": "150 persons",
    "unitType": "persons",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Caterer",
    "group": "Event package",
    "packSize": "200 persons",
    "unitType": "persons",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken",
    "packSize": "1.5 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken boneless",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken boneless",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken boneless",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken boneless",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken boneless",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Chicken boneless",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Mutton",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Mutton",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Mutton",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Mutton",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Mutton",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Mutton",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Mutton",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish (whole / cleaned)",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish (whole / cleaned)",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish (whole / cleaned)",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish (whole / cleaned)",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish (whole / cleaned)",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish (whole / cleaned)",
    "packSize": "1.5 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish (whole / cleaned)",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish slices",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish slices",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish slices",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish slices",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish slices",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Fish slices",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Prawns",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Prawns",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Prawns",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Prawns",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Prawns",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Prawns",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Prawns",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Crab",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Crab",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Crab",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Crab",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Crab",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Crab",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Crab",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Squid",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Squid",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Squid",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Squid",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Squid",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Duck",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Duck",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Duck",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Duck",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Duck",
    "packSize": "1.5 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Duck",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Egg (meat counter)",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Egg (meat counter)",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Egg (meat counter)",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Egg (meat counter)",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Egg (meat counter)",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Meat & fish",
    "group": "Egg (meat counter)",
    "packSize": "30 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Tomato",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Tomato",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Tomato",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Tomato",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Tomato",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Tomato",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Tomato",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Onion",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Onion",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Onion",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Onion",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Onion",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Onion",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Onion",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Potato",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Potato",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Potato",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Potato",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Potato",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Potato",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Potato",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Carrot",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Carrot",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Carrot",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Carrot",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Carrot",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Carrot",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Beans",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Beans",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Beans",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Beans",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Beans",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Beans",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Brinjal",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Brinjal",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Brinjal",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Brinjal",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Brinjal",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Brinjal",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cabbage",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cabbage",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cabbage",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cabbage",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cabbage",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cabbage",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cauliflower",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cauliflower",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cauliflower",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cauliflower",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cauliflower",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cauliflower",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cucumber",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cucumber",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cucumber",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cucumber",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cucumber",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Cucumber",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Leafy greens",
    "packSize": "1 bunch",
    "unitType": "bunch",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Leafy greens",
    "packSize": "2 bunches",
    "unitType": "bunch",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Leafy greens",
    "packSize": "3 bunches",
    "unitType": "bunch",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Leafy greens",
    "packSize": "5 bunches",
    "unitType": "bunch",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Coriander / mint",
    "packSize": "1 bunch",
    "unitType": "bunch",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Coriander / mint",
    "packSize": "2 bunches",
    "unitType": "bunch",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Coriander / mint",
    "packSize": "3 bunches",
    "unitType": "bunch",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Coriander / mint",
    "packSize": "5 bunches",
    "unitType": "bunch",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Green chilli",
    "packSize": "25 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Green chilli",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Green chilli",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Green chilli",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Green chilli",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Lemon",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Lemon",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Lemon",
    "packSize": "5 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Lemon",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Lemon",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Coconut",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Coconut",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Coconut",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Coconut",
    "packSize": "5 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Mushroom",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Mushroom",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Mushroom",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Mushroom",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Mushroom",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Mushroom",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Garlic",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Garlic",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Garlic",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Garlic",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Garlic",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Ginger",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Ginger",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Ginger",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Ginger",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Vegetables",
    "group": "Ginger",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "10 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "20 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "2 L",
    "unitType": "L",
    "displayOrder": 11,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "3 L",
    "unitType": "L",
    "displayOrder": 12,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "5 L",
    "unitType": "L",
    "displayOrder": 13,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Cooking oil",
    "packSize": "10 L",
    "unitType": "L",
    "displayOrder": 14,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "10 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "20 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "2 L",
    "unitType": "L",
    "displayOrder": 11,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Groundnut oil",
    "packSize": "5 L",
    "unitType": "L",
    "displayOrder": 12,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "10 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "20 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "2 L",
    "unitType": "L",
    "displayOrder": 11,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coconut oil",
    "packSize": "5 L",
    "unitType": "L",
    "displayOrder": 12,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Toor dal",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Urad dal",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Urad dal",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Urad dal",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Urad dal",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Urad dal",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Urad dal",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Urad dal",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Urad dal",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Urad dal",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Moong dal",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Moong dal",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Moong dal",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Moong dal",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Moong dal",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Moong dal",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Moong dal",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Moong dal",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Moong dal",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chana dal",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chana dal",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chana dal",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chana dal",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chana dal",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chana dal",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chana dal",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chana dal",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chana dal",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Rajma / chickpeas",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Rajma / chickpeas",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Rajma / chickpeas",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Rajma / chickpeas",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Rajma / chickpeas",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Rajma / chickpeas",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Rajma / chickpeas",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Rajma / chickpeas",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Rajma / chickpeas",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sugar",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sugar",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sugar",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sugar",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sugar",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sugar",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sugar",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sugar",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sugar",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Salt",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Salt",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Salt",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Salt",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Salt",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Salt",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Salt",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Jaggery",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Jaggery",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Jaggery",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Jaggery",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Jaggery",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Jaggery",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Jaggery",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Jaggery",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chilli powder",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chilli powder",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chilli powder",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chilli powder",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chilli powder",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chilli powder",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chilli powder",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chilli powder",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Chilli powder",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Turmeric powder",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Turmeric powder",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Turmeric powder",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Turmeric powder",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Turmeric powder",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Turmeric powder",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Turmeric powder",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Turmeric powder",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coriander powder",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coriander powder",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coriander powder",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coriander powder",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coriander powder",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coriander powder",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coriander powder",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coriander powder",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coriander powder",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Garam masala",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Garam masala",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Garam masala",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Garam masala",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Garam masala",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Garam masala",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Garam masala",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Garam masala",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Whole spices",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Whole spices",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Whole spices",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Whole spices",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Whole spices",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Whole spices",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Whole spices",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Whole spices",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Wheat flour / atta",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Maida",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Maida",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Maida",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Maida",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Maida",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Maida",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Maida",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Maida",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Besan",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Besan",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Besan",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Besan",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Besan",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Besan",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Besan",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Besan",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Pickle",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Pickle",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Pickle",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Pickle",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Pickle",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Pickle",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Pickle",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Pickle",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Pickle",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Honey",
    "packSize": "10 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Honey",
    "packSize": "20 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Honey",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Honey",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Honey",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Honey",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Honey",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Honey",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Honey",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "10 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "20 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Sauce",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Vinegar",
    "packSize": "10 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Vinegar",
    "packSize": "20 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Vinegar",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Vinegar",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Vinegar",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Vinegar",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Vinegar",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Vinegar",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Vinegar",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Dry fruits",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Dry fruits",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Dry fruits",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Dry fruits",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Dry fruits",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Dry fruits",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Dry fruits",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Dry fruits",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Dry fruits",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Nuts / seeds",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Nuts / seeds",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Nuts / seeds",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Nuts / seeds",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Nuts / seeds",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Nuts / seeds",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Nuts / seeds",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Nuts / seeds",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Nuts / seeds",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Tea powder",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Tea powder",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Tea powder",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Tea powder",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Tea powder",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Tea powder",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Tea powder",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Tea powder",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coffee powder",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coffee powder",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coffee powder",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coffee powder",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coffee powder",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coffee powder",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coffee powder",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Coffee powder",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Instant mixes",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Instant mixes",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Instant mixes",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Instant mixes",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Instant mixes",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Instant mixes",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Instant mixes",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Instant mixes",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Biscuits",
    "packSize": "1 pack",
    "unitType": "pack/set/loaf",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Biscuits",
    "packSize": "2 packs",
    "unitType": "pack/set/loaf",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Biscuits",
    "packSize": "3 packs",
    "unitType": "pack/set/loaf",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Biscuits",
    "packSize": "5 packs",
    "unitType": "pack/set/loaf",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Biscuits",
    "packSize": "10 packs",
    "unitType": "pack/set/loaf",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Noodles / pasta",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Noodles / pasta",
    "packSize": "70 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Noodles / pasta",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Noodles / pasta",
    "packSize": "150 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Noodles / pasta",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Noodles / pasta",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Noodles / pasta",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Groceries",
    "group": "Noodles / pasta",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Regular eggs",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Regular eggs",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Regular eggs",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Regular eggs",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Regular eggs",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Regular eggs",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Regular eggs",
    "packSize": "15 pcs",
    "unitType": "pcs",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Regular eggs",
    "packSize": "18 pcs",
    "unitType": "pcs",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Regular eggs",
    "packSize": "30 pcs",
    "unitType": "pcs",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Country eggs",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Country eggs",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Country eggs",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Country eggs",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Country eggs",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Country eggs",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Country eggs",
    "packSize": "15 pcs",
    "unitType": "pcs",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Quail eggs",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Quail eggs",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Quail eggs",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Quail eggs",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Quail eggs",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Quail eggs",
    "packSize": "20 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Quail eggs",
    "packSize": "30 pcs",
    "unitType": "pcs",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Egg tray",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Egg tray",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Egg tray",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Egg tray",
    "packSize": "15 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Egg tray",
    "packSize": "18 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Eggs",
    "group": "Egg tray",
    "packSize": "30 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Bread loaf",
    "packSize": "1 loaf",
    "unitType": "pack/set/loaf",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Bread loaf",
    "packSize": "2 loaves",
    "unitType": "pack/set/loaf",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Bread loaf",
    "packSize": "3 loaves",
    "unitType": "pack/set/loaf",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Bread loaf",
    "packSize": "4 loaves",
    "unitType": "pack/set/loaf",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cakes",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cakes",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cakes",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cakes",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cakes",
    "packSize": "1.5 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cakes",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cakes",
    "packSize": "2.5 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cakes",
    "packSize": "3 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cupcakes",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cupcakes",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cupcakes",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cupcakes",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cupcakes",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cupcakes",
    "packSize": "24 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Muffins",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Muffins",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Muffins",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Muffins",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Muffins",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Buns",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Buns",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Buns",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Buns",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Buns",
    "packSize": "8 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Buns",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cookies",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cookies",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cookies",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cookies",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cookies",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cookies",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cookies",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Cookies",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Rusk",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Rusk",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Rusk",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Rusk",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Rusk",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Rusk",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Pastries",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Pastries",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Pastries",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Pastries",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Pastries",
    "packSize": "8 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Puffs",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Puffs",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Puffs",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Puffs",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Puffs",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Brownies",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Brownies",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Brownies",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Brownies",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Brownies",
    "packSize": "9 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Brownies",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Donuts",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Donuts",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Donuts",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Donuts",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Bakery",
    "group": "Donuts",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Mixture",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Mixture",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Mixture",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Mixture",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Mixture",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Mixture",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Mixture",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Mixture",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Murukku",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Murukku",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Murukku",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Murukku",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Murukku",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Murukku",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Murukku",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Murukku",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Chips",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Chips",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Chips",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Chips",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Chips",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Chips",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Chips",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Popcorn",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Popcorn",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Popcorn",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Popcorn",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Popcorn",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Popcorn",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Popcorn",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Samosa",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Samosa",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Samosa",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Samosa",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Samosa",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Samosa",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Samosa",
    "packSize": "20 pcs",
    "unitType": "pcs",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Bajji / pakoda",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Bajji / pakoda",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Bajji / pakoda",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Bajji / pakoda",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Bajji / pakoda",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Bajji / pakoda",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Cutlet",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Cutlet",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Cutlet",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Cutlet",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Cutlet",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Vadai",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Vadai",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Vadai",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Vadai",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Vadai",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Traditional sweets",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Traditional sweets",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Traditional sweets",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Traditional sweets",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Traditional sweets",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Traditional sweets",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Traditional sweets",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Traditional sweets",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Snack combo",
    "packSize": "Small pack",
    "unitType": "pack/set/loaf",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Snack combo",
    "packSize": "Medium pack",
    "unitType": "pack/set/loaf",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Snack combo",
    "packSize": "Large pack",
    "unitType": "pack/set/loaf",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Snacks",
    "group": "Snack combo",
    "packSize": "Family pack",
    "unitType": "pack/set/loaf",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Raw rice",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Raw rice",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Raw rice",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Raw rice",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Raw rice",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Raw rice",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Raw rice",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Raw rice",
    "packSize": "25 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Boiled rice",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Boiled rice",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Boiled rice",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Boiled rice",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Boiled rice",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Boiled rice",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Boiled rice",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Boiled rice",
    "packSize": "25 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Idli rice",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Idli rice",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Idli rice",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Idli rice",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Idli rice",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Idli rice",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Idli rice",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Basmati rice",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Basmati rice",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Basmati rice",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Basmati rice",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Basmati rice",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Basmati rice",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Basmati rice",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Millets",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Millets",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Millets",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Millets",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Millets",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Millets",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Millets",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Millets",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Millets",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Ragi flour",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Ragi flour",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Ragi flour",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Ragi flour",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Ragi flour",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Ragi flour",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Ragi flour",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Ragi flour",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Ragi flour",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Wheat",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Wheat",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Wheat",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Wheat",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Wheat",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Wheat",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Wheat",
    "packSize": "10 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Rava / sooji",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Rava / sooji",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Rava / sooji",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Rava / sooji",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Rava / sooji",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Rava / sooji",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Rava / sooji",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Rava / sooji",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Poha / aval",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Poha / aval",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Poha / aval",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Poha / aval",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Poha / aval",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Poha / aval",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Poha / aval",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Poha / aval",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Vermicelli",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Vermicelli",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Vermicelli",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Vermicelli",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Vermicelli",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Rice & staples",
    "group": "Vermicelli",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "10 ml",
    "unitType": "ml",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "20 ml",
    "unitType": "ml",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "50 ml",
    "unitType": "ml",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "75 ml",
    "unitType": "ml",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "100 ml",
    "unitType": "ml",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "200 ml",
    "unitType": "ml",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "250 ml",
    "unitType": "ml",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "500 ml",
    "unitType": "ml",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "750 ml",
    "unitType": "ml",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "1 L",
    "unitType": "L",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "2 L",
    "unitType": "L",
    "displayOrder": 11,
    "active": true
  },
  {
    "category": "Other",
    "group": "Liquid product",
    "packSize": "5 L",
    "unitType": "L",
    "displayOrder": 12,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "10 g",
    "unitType": "g",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "20 g",
    "unitType": "g",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "50 g",
    "unitType": "g",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "75 g",
    "unitType": "g",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "100 g",
    "unitType": "g",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "200 g",
    "unitType": "g",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "250 g",
    "unitType": "g",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "500 g",
    "unitType": "g",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "750 g",
    "unitType": "g",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "1 kg",
    "unitType": "kg",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "2 kg",
    "unitType": "kg",
    "displayOrder": 11,
    "active": true
  },
  {
    "category": "Other",
    "group": "Powder / granular product",
    "packSize": "5 kg",
    "unitType": "kg",
    "displayOrder": 12,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "1 pc",
    "unitType": "pcs",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "2 pcs",
    "unitType": "pcs",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "3 pcs",
    "unitType": "pcs",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "4 pcs",
    "unitType": "pcs",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "5 pcs",
    "unitType": "pcs",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "6 pcs",
    "unitType": "pcs",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "10 pcs",
    "unitType": "pcs",
    "displayOrder": 7,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "12 pcs",
    "unitType": "pcs",
    "displayOrder": 8,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "20 pcs",
    "unitType": "pcs",
    "displayOrder": 9,
    "active": true
  },
  {
    "category": "Other",
    "group": "Piece-based product",
    "packSize": "30 pcs",
    "unitType": "pcs",
    "displayOrder": 10,
    "active": true
  },
  {
    "category": "Other",
    "group": "Packaged product",
    "packSize": "1 pack",
    "unitType": "pack/set/loaf",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Other",
    "group": "Packaged product",
    "packSize": "2 packs",
    "unitType": "pack/set/loaf",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Other",
    "group": "Packaged product",
    "packSize": "3 packs",
    "unitType": "pack/set/loaf",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Other",
    "group": "Packaged product",
    "packSize": "5 packs",
    "unitType": "pack/set/loaf",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Other",
    "group": "Packaged product",
    "packSize": "10 packs",
    "unitType": "pack/set/loaf",
    "displayOrder": 5,
    "active": true
  },
  {
    "category": "Other",
    "group": "Packaged product",
    "packSize": "20 packs",
    "unitType": "pack/set/loaf",
    "displayOrder": 6,
    "active": true
  },
  {
    "category": "Other",
    "group": "Set-based product",
    "packSize": "Set of 1",
    "unitType": "pack/set/loaf",
    "displayOrder": 1,
    "active": true
  },
  {
    "category": "Other",
    "group": "Set-based product",
    "packSize": "Set of 2",
    "unitType": "pack/set/loaf",
    "displayOrder": 2,
    "active": true
  },
  {
    "category": "Other",
    "group": "Set-based product",
    "packSize": "Set of 3",
    "unitType": "pack/set/loaf",
    "displayOrder": 3,
    "active": true
  },
  {
    "category": "Other",
    "group": "Set-based product",
    "packSize": "Set of 4",
    "unitType": "pack/set/loaf",
    "displayOrder": 4,
    "active": true
  },
  {
    "category": "Other",
    "group": "Set-based product",
    "packSize": "Set of 5",
    "unitType": "pack/set/loaf",
    "displayOrder": 5,
    "active": true
  }
] as const;

/** Map of Category -> Array of unique SKU group names */
export const SKU_GROUPS_BY_CATEGORY: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const cat of SKU_CATEGORIES) {
    map[cat] = [];
  }
  for (const rec of SKU_MASTER_RECORDS) {
    if (!map[rec.category]) map[rec.category] = [];
    if (!map[rec.category].includes(rec.group)) {
      map[rec.category].push(rec.group);
    }
  }
  return map;
})();

/** Map of "Category:::Group" -> Array of SkuRecords */
export const SKUS_BY_CATEGORY_AND_GROUP: Record<string, SkuRecord[]> = (() => {
  const map: Record<string, SkuRecord[]> = {};
  for (const rec of SKU_MASTER_RECORDS) {
    const key = `${rec.category}:::${rec.group}`;
    if (!map[key]) map[key] = [];
    map[key].push(rec);
  }
  // Sort each by displayOrder
  for (const key in map) {
    map[key].sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return map;
})();

/** Get active SKU groups for a category */
export function getSkuGroups(category: string): string[] {
  return SKU_GROUPS_BY_CATEGORY[category] || [];
}

/** Get active pack sizes and unit types for a given category and product group */
export function getSkusForGroup(category: string, group: string, includeInactive = false): SkuRecord[] {
  const list = SKUS_BY_CATEGORY_AND_GROUP[`${category}:::${group}`] || [];
  return includeInactive ? list : list.filter((item) => item.active);
}

/** Find an exact SKU definition */
export function findSkuDefinition(category: string, group: string, packSize: string): SkuRecord | undefined {
  const list = SKUS_BY_CATEGORY_AND_GROUP[`${category}:::${group}`] || [];
  return list.find((item) => item.packSize.toLowerCase() === packSize.toLowerCase().trim());
}

/** Validate whether a category, product group and pack size combination is valid */
export function validateSkuSelection(
  category: string,
  group: string,
  packSize: string,
  customUnit?: string
): { valid: boolean; sku?: SkuRecord; error?: string } {
  if (!category || !SKU_CATEGORIES.includes(category)) {
    return { valid: false, error: `Invalid category: "${category}". Must be one of the 11 defined categories.` };
  }
  const isOtherGroup = group === "Other" || group.trim().toLowerCase() === "other";
  const isOtherPack = packSize === "Other" || packSize.trim().toLowerCase() === "other";

  if (isOtherGroup || isOtherPack) {
    if (!group.trim()) {
      return { valid: false, error: "Please enter or select a product / SKU group." };
    }
    if (!packSize.trim()) {
      return { valid: false, error: "Please enter or select a pack size." };
    }
    const unit = (customUnit as SkuUnitType) || "pack/set/loaf";
    return {
      valid: true,
      sku: {
        category,
        group,
        packSize,
        unitType: unit,
        displayOrder: 9999,
        active: true,
      },
    };
  }

  const groups = getSkuGroups(category);
  if (!group || !groups.includes(group)) {
    return { valid: false, error: `Product group "${group}" does not belong to category "${category}".` };
  }
  const sku = findSkuDefinition(category, group, packSize);
  if (!sku) {
    return { valid: false, error: `Pack size "${packSize}" is not predefined for "${category} -> ${group}".` };
  }
  if (!sku.active) {
    return { valid: false, error: `The selected SKU "${packSize}" is currently inactive.` };
  }
  return { valid: true, sku };
}

/**
 * Format product name and pack size cleanly for customer display without duplicate units.
 * e.g. "Milk", "500 ml" -> "Milk – 500 ml"
 * If product name already ends with pack size, returns as-is.
 */
export function formatProductPackLabel(name: string, packSize?: string): string {
  if (!packSize) return name;
  const cleanName = name.trim();
  const cleanPack = packSize.trim();
  if (cleanName.toLowerCase().endsWith(cleanPack.toLowerCase())) {
    return cleanName;
  }
  return `${cleanName} – ${cleanPack}`;
}

/** Parse a pack size label and unit type into a measurable amount and measure for nutrition estimation */
export function parsePackSpec(
  packSize: string,
  unitType: SkuUnitType | string
): { amount: number; measure: string; label: string } {
  if (!packSize) return { amount: 1, measure: unitType || "pack", label: packSize || "1 pack" };
  const match = packSize.match(/^([\d.]+)\s*(.*)$/);
  if (match) {
    const num = parseFloat(match[1]);
    const rawMeasure = match[2].trim().toLowerCase();
    let measure = rawMeasure;
    if (measure === "l") measure = "litre";
    else if (measure === "pc" || measure === "pcs") measure = "piece";
    else if (measure === "bunch" || measure === "bunches") measure = "bunch";
    else if (measure === "loaf" || measure === "loaves") measure = "loaf";
    else if (measure === "person" || measure === "persons") measure = "persons";
    else if (measure === "pack" || measure === "packs") measure = "pack";
    return { amount: isNaN(num) ? 1 : num, measure: measure || unitType, label: packSize };
  }
  return { amount: 1, measure: unitType || "portion", label: packSize };
}
