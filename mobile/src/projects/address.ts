// Texto legible de una dirección devuelta por el geocodificador del teléfono. Código puro, para probarlo en Node.

// Los mismos campos que `LocationGeocodedAddress` de expo-location; todos pueden faltar según la plataforma.
export interface GeocodedAddress {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
}

const clean = (value?: string | null) => (value ?? "").trim();

// Formato estadounidense: «123 Main St, Portland, OR 97201, United States». Se compone a mano para que sea igual en
// Android e iOS; si queda casi vacío se cae a `formattedAddress`. Sin datos devuelve "".
export function formatAddress(address: GeocodedAddress): string {
  const streetLine = [clean(address.streetNumber), clean(address.street)].filter(Boolean).join(" ");
  const parts = [
    streetLine || clean(address.name),
    clean(address.city) || clean(address.district) || clean(address.subregion),
    [clean(address.region), clean(address.postalCode)].filter(Boolean).join(" "),
    clean(address.country),
  ];
  const unique: string[] = [];
  for (const part of parts) {
    if (part && !unique.some((existing) => existing.toLowerCase() === part.toLowerCase())) unique.push(part);
  }
  if (unique.length >= 2) return unique.join(", ");
  return clean(address.formattedAddress) || unique.join(", ");
}
