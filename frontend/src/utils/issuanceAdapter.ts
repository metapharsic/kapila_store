export interface APIIssuanceItem {
  name: string;
  qty: number;
  issued: number;
  unit: string;
  item_code: string | null;
  unit_price: number | null;
}

export interface APIIssuance {
  id: number;
  indent_id: number | null;
  dept: string;
  date: string;
  scanned: boolean;
  items: APIIssuanceItem[];
}

export interface FrontendIssuanceItem {
  name: string;
  qty: number;
  issued: number;
  unit: string;
  itemCode: string | null;
  unitPrice: number | null;
}

export interface FrontendIssuance {
  id: number;
  indentId: number | null;
  dept: string;
  date: string;
  scanned: boolean;
  items: FrontendIssuanceItem[];
}

export function toFrontendIssuanceItem(apiItem: APIIssuanceItem): FrontendIssuanceItem {
  return {
    name: apiItem.name,
    qty: apiItem.qty,
    issued: apiItem.issued,
    unit: apiItem.unit,
    itemCode: apiItem.item_code,
    unitPrice: apiItem.unit_price,
  };
}

export function toAPIIssuanceItem(frontendItem: FrontendIssuanceItem): APIIssuanceItem {
  return {
    name: frontendItem.name,
    qty: frontendItem.qty,
    issued: frontendItem.issued,
    unit: frontendItem.unit,
    item_code: frontendItem.itemCode,
    unit_price: frontendItem.unitPrice,
  };
}

export function toFrontendIssuance(apiData: APIIssuance): FrontendIssuance {
  return {
    id: apiData.id,
    indentId: apiData.indent_id,
    dept: apiData.dept,
    date: apiData.date,
    scanned: apiData.scanned,
    items: (apiData.items || []).map(toFrontendIssuanceItem),
  };
}

export function toAPIIssuance(frontendData: Partial<FrontendIssuance>): Partial<APIIssuance> {
  const result: Partial<APIIssuance> = {};

  if (frontendData.indentId !== undefined) result.indent_id = frontendData.indentId;
  if (frontendData.dept !== undefined) result.dept = frontendData.dept;
  if (frontendData.date !== undefined) result.date = frontendData.date;
  if (frontendData.scanned !== undefined) result.scanned = frontendData.scanned;
  if (frontendData.items !== undefined) {
    result.items = frontendData.items.map(toAPIIssuanceItem);
  }

  return result;
}
