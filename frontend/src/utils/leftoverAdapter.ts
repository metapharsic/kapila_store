export interface APILeftover {
  id: number;
  dept: string;
  date: string;
  item: string;
  qty: number;
  unit: string;
  carried_forward: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FrontendLeftover {
  id: number;
  dept: string;
  date: string;
  item: string;
  qty: number;
  unit: string;
  carriedForward: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function toFrontendLeftover(apiData: APILeftover): FrontendLeftover {
  return {
    id: apiData.id,
    dept: apiData.dept,
    date: apiData.date,
    item: apiData.item,
    qty: apiData.qty,
    unit: apiData.unit,
    carriedForward: apiData.carried_forward,
    createdAt: apiData.created_at,
    updatedAt: apiData.updated_at,
  };
}

export function toAPILeftover(frontendData: Partial<FrontendLeftover>): Partial<APILeftover> {
  const result: Partial<APILeftover> = {};

  if (frontendData.id !== undefined) result.id = frontendData.id;
  if (frontendData.dept !== undefined) result.dept = frontendData.dept;
  if (frontendData.date !== undefined) result.date = frontendData.date;
  if (frontendData.item !== undefined) result.item = frontendData.item;
  if (frontendData.qty !== undefined) result.qty = frontendData.qty;
  if (frontendData.unit !== undefined) result.unit = frontendData.unit;
  if (frontendData.carriedForward !== undefined) {
    result.carried_forward = frontendData.carriedForward;
  }

  return result;
}
