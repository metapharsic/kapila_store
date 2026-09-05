export interface APIStock {
  id: number;
  name: string;
  qty: number;
  unit: string;
  date: string;
  price: number | null;
  supplier: string | null;
  expiry_date: string | null;
  min_alert_qty: number | null;
  item_code: string | null;
  category: string | null;
}

export interface FrontendStock {
  id: number;
  name: string;
  qty: number;
  unit: string;
  date: string;
  price: number | null;
  supplier: string | null;
  expiryDate: string | null;
  minAlertQty: number | null;
  itemCode: string | null;
  category: string | null;
}

export function toFrontendStock(apiData: APIStock): FrontendStock {
  return {
    id: apiData.id,
    name: apiData.name,
    qty: apiData.qty,
    unit: apiData.unit,
    date: apiData.date,
    price: apiData.price,
    supplier: apiData.supplier,
    expiryDate: apiData.expiry_date,
    minAlertQty: apiData.min_alert_qty,
    itemCode: apiData.item_code,
    category: apiData.category,
  };
}

export function toAPIStock(frontendData: Partial<FrontendStock>): Partial<APIStock> {
  const result: Partial<APIStock> = {};

  if (frontendData.name !== undefined) result.name = frontendData.name;
  if (frontendData.qty !== undefined) result.qty = frontendData.qty;
  if (frontendData.unit !== undefined) result.unit = frontendData.unit;
  if (frontendData.date !== undefined) result.date = frontendData.date;
  if (frontendData.price !== undefined) result.price = frontendData.price;
  if (frontendData.supplier !== undefined) result.supplier = frontendData.supplier;
  if (frontendData.expiryDate !== undefined) result.expiry_date = frontendData.expiryDate;
  if (frontendData.minAlertQty !== undefined) result.min_alert_qty = frontendData.minAlertQty;
  if (frontendData.itemCode !== undefined) result.item_code = frontendData.itemCode;
  if (frontendData.category !== undefined) result.category = frontendData.category;

  return result;
}
