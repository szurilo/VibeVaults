/**
 * Main Responsibility: Single source of truth for the operator's legal identity.
 * Both the privacy policy (GDPR Art. 13(1)(a) controller identity) and the
 * terms of service (Ekertv. 4. § service provider disclosure) have to name the
 * same entity with the same registration numbers, and two hand-maintained
 * copies would drift the moment one of them changes.
 *
 * Sensitive Dependencies:
 * - Rendered publicly on /privacy-policy and /terms-of-service. A blank field is
 *   omitted from the render rather than shown as an empty label, so an unfilled
 *   value degrades quietly but is still a disclosure gap.
 * - "Egyéni vállalkozó" is rendered in English as "sole trader". The Hungarian
 *   term is kept alongside it because that is what identifies the legal form to
 *   a Hungarian authority or to NAIH.
 */
export const OPERATOR = {
    name: "József Tar",
    legalForm: "Sole trader registered in Hungary (Hungarian: egyéni vállalkozó, abbreviated “e.v.”)",
    shortLegalForm: "e.v. (sole trader)",
    registrationNumber: "61558557", // e.v. nyilvántartási szám
    taxNumber: "91621728-1-33", // adószám
    address: "Zápolya utca 16. 1/a, 2120 Dunakeszi, Hungary", // registered seat (székhely)
    email: "support@vibe-vaults.com",
    country: "Hungary, European Union",
} as const;
