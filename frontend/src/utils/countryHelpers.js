// Country list and validation utilities
export const COUNTRIES = [
  { code: "AU", name: "Australia", default: true },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "JP", name: "Japan" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" },
  { code: "IN", name: "India" },
  { code: "CN", name: "China" },
  { code: "KR", name: "South Korea" },
  { code: "TH", name: "Thailand" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "VN", name: "Vietnam" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "OTHER", name: "Other" },
];

export const getStateLabel = (country) => {
  const stateLabels = {
    Australia: "State",
    "United States": "State",
    USA: "State",
    Canada: "Province",
    "United Kingdom": "County",
    UK: "County",
    Germany: "State",
    France: "Region",
    Italy: "Region",
    Spain: "Province",
    India: "State",
    China: "Province",
    Brazil: "State",
    Mexico: "State",
  };
  return stateLabels[country] || "State/Province";
};

export const getPostcodeLabel = (country) => {
  const postcodeLabels = {
    Australia: "Postcode",
    "United States": "ZIP Code",
    USA: "ZIP Code",
    Canada: "Postal Code",
    "United Kingdom": "Postcode",
    UK: "Postcode",
    Germany: "Postleitzahl",
    France: "Code Postal",
    Italy: "Codice Postale",
    Spain: "Código Postal",
    Netherlands: "Postcode",
    Belgium: "Postcode",
    Switzerland: "Postleitzahl",
  };
  return postcodeLabels[country] || "Postal Code";
};

export const getSuburbLabel = (country) => {
  const suburbLabels = {
    Australia: "Suburb",
    "United States": "City",
    USA: "City",
    Canada: "City",
    "United Kingdom": "City",
    UK: "City",
    Germany: "City",
    France: "City",
    Italy: "City",
    Spain: "City",
    Netherlands: "City",
  };
  return suburbLabels[country] || "City/Suburb";
};

export const validatePostcode = (postcode, country) => {
  const trimmed = postcode.trim();

  const validations = {
    Australia: {
      regex: /^[0-9]{4}$/,
      message: "Australian postcode must be 4 digits",
      example: "2000",
    },
    "United States": {
      regex: /^[0-9]{5}(-[0-9]{4})?$/,
      message: "US ZIP code must be 5 digits or ZIP+4 format",
      example: "12345 or 12345-6789",
    },
    USA: {
      regex: /^[0-9]{5}(-[0-9]{4})?$/,
      message: "US ZIP code must be 5 digits or ZIP+4 format",
      example: "12345 or 12345-6789",
    },
    Canada: {
      regex: /^[A-Z][0-9][A-Z] [0-9][A-Z][0-9]$/i,
      message: "Canadian postal code must be in A1A 1A1 format",
      example: "K1A 0A6",
    },
    "United Kingdom": {
      regex: /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i,
      message: "UK postcode must be in valid format",
      example: "SW1A 1AA",
    },
    UK: {
      regex: /^[A-Z]{1,2}[0-9R][0-9A-Z]? [0-9][A-Z]{2}$/i,
      message: "UK postcode must be in valid format",
      example: "SW1A 1AA",
    },
    Germany: {
      regex: /^[0-9]{5}$/,
      message: "German postcode must be 5 digits",
      example: "10115",
    },
    France: {
      regex: /^[0-9]{5}$/,
      message: "French postal code must be 5 digits",
      example: "75001",
    },
    Netherlands: {
      regex: /^[0-9]{4} [A-Z]{2}$/i,
      message: "Dutch postcode must be in 1234 AB format",
      example: "1012 AB",
    },
  };

  const validation = validations[country];
  if (!validation) {
    // For countries without specific validation, just check it's not empty
    return {
      valid: trimmed.length > 0,
      message: trimmed.length === 0 ? "Postal code is required" : null,
      example: "Enter postal code for " + country,
    };
  }

  return {
    valid: validation.regex.test(trimmed),
    message: validation.valid ? null : validation.message,
    example: validation.example,
  };
};
