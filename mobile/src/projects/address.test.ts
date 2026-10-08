import { describe, expect, it } from "vitest";
import { formatAddress } from "./address";

describe("texto de una dirección", () => {
  it("formato estadounidense completo: número y calle, ciudad, estado y código postal, país", () => {
    expect(
      formatAddress({ streetNumber: "1600", street: "Pennsylvania Ave NW", city: "Washington", region: "DC", postalCode: "20500", country: "United States" })
    ).toBe("1600 Pennsylvania Ave NW, Washington, DC 20500, United States");
  });

  it("sin número usa solo la calle; sin calle usa el nombre", () => {
    expect(formatAddress({ street: "Main St", city: "Portland", region: "OR" })).toBe("Main St, Portland, OR");
    expect(formatAddress({ name: "Pioneer Courthouse Square", city: "Portland", region: "OR" })).toBe("Pioneer Courthouse Square, Portland, OR");
  });

  it("quita partes repetidas sin distinguir mayúsculas", () => {
    expect(formatAddress({ name: "Portland", city: "portland", region: "OR", country: "USA" })).toBe("Portland, OR, USA");
  });

  it("usa el distrito o el condado si no hay ciudad", () => {
    expect(formatAddress({ street: "Rural Rd", district: "Beaverton", region: "OR" })).toBe("Rural Rd, Beaverton, OR");
    expect(formatAddress({ street: "Rural Rd", subregion: "Washington County", region: "OR" })).toBe("Rural Rd, Washington County, OR");
  });

  it("ignora espacios y valores nulos o vacíos", () => {
    expect(formatAddress({ streetNumber: " 12 ", street: " Oak St ", city: null, region: "", postalCode: "  ", country: "USA" })).toBe("12 Oak St, USA");
  });

  it("si lo compuesto queda con una sola parte usa formattedAddress", () => {
    expect(formatAddress({ country: "United States", formattedAddress: "Somewhere Rd, Bend, OR 97701, United States" })).toBe("Somewhere Rd, Bend, OR 97701, United States");
  });

  it("sin ningún dato devuelve texto vacío", () => {
    expect(formatAddress({})).toBe("");
    expect(formatAddress({ street: null, city: null, formattedAddress: null })).toBe("");
  });

  it("con una sola parte y sin formattedAddress devuelve esa parte", () => {
    expect(formatAddress({ country: "Mexico" })).toBe("Mexico");
  });
});
