export interface APIIndentItem {
  name: string;
  qty: number;
  unit: string;
  item_code: string;
}

export interface APIIndent {
  id: number;
  dept: string;
  date: string;
  indent_type: "routine" | "adhoc";
  status: string;
  items: APIIndentItem[];
}

export interface FrontendIndentItem {
  name: string;
  qty: number;
  unit: string;
  itemCode: string;
}

export interface FrontendIndent {
  id: number;
  dept: string;
  date: string;
  indentType: "routine" | "adhoc";
  status: string;
  items: FrontendIndentItem[];
}

export function toFrontendIndentItem(apiItem: APIIndentItem): FrontendIndentItem {
  return {
    name: apiItem.name,
    qty: apiItem.qty,
    unit: apiItem.unit,
    itemCode: apiItem.item_code,
  };
}

export function toAPIIndentItem(frontendItem: FrontendIndentItem): APIIndentItem {
  return {
    name: frontendItem.name,
    qty: frontendItem.qty,
    unit: frontendItem.unit,
    item_code: frontendItem.itemCode,
  };
}

export function toFrontendIndent(apiData: APIIndent): FrontendIndent {
  return {
    id: apiData.id,
    dept: apiData.dept,
    date: apiData.date,
    indentType: apiData.indent_type,
    status: apiData.status,
    items: (apiData.items || []).map(toFrontendIndentItem),
  };
}

export function toAPIIndent(frontendData: Partial<FrontendIndent>): Partial<APIIndent> {
  const result: Partial<APIIndent> = {};

  if (frontendData.dept !== undefined) result.dept = frontendData.dept;
  if (frontendData.date !== undefined) result.date = frontendData.date;
  if (frontendData.indentType !== undefined) result.indent_type = frontendData.indentType;
  if (frontendData.status !== undefined) result.status = frontendData.status;
  if (frontendData.items !== undefined) {
    result.items = frontendData.items.map(toAPIIndentItem);
  }

  return result;
}
