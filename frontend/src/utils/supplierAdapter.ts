export interface APISupplier {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  rating?: number | null;
}

export interface FrontendSupplier {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  address: string | null;
  rating?: number | null;
}

// Maps backend response data to frontend domain model
export function toFrontendSupplier(apiData: APISupplier): FrontendSupplier {
  return {
    id: apiData.id,
    name: apiData.name,
    contactName: apiData.contact_name,
    phone: apiData.phone,
    email: apiData.email,
    gstNumber: apiData.gstin,
    address: apiData.address,
    rating: apiData.rating,
  };
}

// Maps frontend input back to the backend snake_case format
export function toAPISupplier(frontendData: Partial<FrontendSupplier>): Partial<APISupplier> {
  const result: Partial<APISupplier> = {};
  
  if (frontendData.name !== undefined) result.name = frontendData.name;
  if (frontendData.contactName !== undefined) result.contact_name = frontendData.contactName;
  if (frontendData.phone !== undefined) result.phone = frontendData.phone;
  if (frontendData.email !== undefined) result.email = frontendData.email;
  if (frontendData.gstNumber !== undefined) result.gstin = frontendData.gstNumber;
  if (frontendData.address !== undefined) result.address = frontendData.address;
  if (frontendData.rating !== undefined) result.rating = frontendData.rating;

  return result;
}
