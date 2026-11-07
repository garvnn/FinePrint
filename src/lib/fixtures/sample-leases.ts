/**
 * FICTIONAL sample leases. All names, addresses and companies are invented.
 *
 * This file is the single source of truth for the demo leases:
 *  - scripts/generate-sample-pdfs.ts renders them into public/samples/*.pdf
 *  - fixture mode (no PDF) renders them directly into LeasePages.
 */
import type { LeaseDocument } from "@/types/lease";
import { buildPageFromText } from "@/lib/pdf/layout";

export interface SampleSection {
  heading: string;
  paragraphs: string[];
}

export interface SampleLease {
  id: "sample-a" | "sample-b";
  fileName: string;
  title: string;
  subtitle: string;
  summary: string;
  preamble: string[];
  sections: SampleSection[];
}

const BANNER = "FICTIONAL SAMPLE LEASE FOR DEMONSTRATION ONLY. NOT A REAL AGREEMENT.";

export const SAMPLE_A: SampleLease = {
  id: "sample-a",
  fileName: "fineprint-sample-lease-a.pdf",
  title: "RESIDENTIAL LEASE AGREEMENT",
  subtitle: BANNER,
  summary: "Problematic lease: $1,800 rent, $2,700 deposit, extra move-in fees, early-termination fee, broad repair duties.",
  preamble: [
    "This Residential Lease Agreement is made between Elmstone Property Group LLC (\"Landlord\") and Jordan Example and Riley Sample (together, \"Tenant\"). All names in this document are fictional.",
    "Premises: 100 Example Street, Unit 3, Boston, Massachusetts 02115 (a fictional address).",
  ],
  sections: [
    {
      heading: "1. TERM",
      paragraphs: [
        "The term of this Lease is twelve (12) months, beginning September 1, 2026 and ending August 31, 2027.",
      ],
    },
    {
      heading: "2. RENT",
      paragraphs: [
        "Tenant shall pay monthly rent of $1,800.00, payable in advance on the first day of each month. The total rent for the term is $21,600.00. Rent shall be paid by electronic transfer to the account designated by Landlord.",
      ],
    },
    {
      heading: "3. PAYMENTS DUE AT SIGNING",
      paragraphs: [
        "At lease signing, Tenant shall pay: (a) first month's rent of $1,800.00; (b) last month's rent of $1,800.00; (c) the security deposit of $2,700.00; (d) a non-refundable move-in fee of $350.00; and (e) a key fee of $75.00.",
      ],
    },
    {
      heading: "4. SECURITY DEPOSIT",
      paragraphs: [
        "Tenant shall pay a security deposit of $2,700.00 upon signing this Lease. Landlord may apply the deposit to unpaid rent or damage beyond normal wear and tear.",
      ],
    },
    {
      heading: "5. AMENITY FEE",
      paragraphs: [
        "In addition to rent, Tenant shall pay a monthly amenity fee of $40.00 for access to the building fitness room and package lockers.",
      ],
    },
    {
      heading: "6. LATE PAYMENT",
      paragraphs: [
        "If any rent payment is not received within five (5) days after its due date, Tenant shall pay a late fee of $75.00 for each late payment.",
      ],
    },
    {
      heading: "7. UTILITIES",
      paragraphs: [
        "Tenant shall pay for all utilities, including electricity, gas, heat, hot water, and water and sewer charges. Water, sewer, and heat charges shall be allocated among the units in the building based on the number of occupants.",
      ],
    },
    {
      heading: "8. MAINTENANCE AND REPAIRS",
      paragraphs: [
        "Tenant shall be responsible for all repairs to the Premises, including plumbing, heating, and appliances, and shall pay the first $250.00 of the cost of each repair regardless of cause. Tenant shall keep the Premises clean and sanitary.",
      ],
    },
    {
      heading: "9. EARLY TERMINATION",
      paragraphs: [
        "Tenant may terminate this Lease early by providing sixty (60) days' written notice and paying an early termination fee equal to two (2) months' rent ($3,600.00). Payment of this fee shall not release Tenant from liability for rent until the Premises are re-rented.",
      ],
    },
    {
      heading: "10. RENEWAL",
      paragraphs: [
        "This Lease shall automatically renew for an additional twelve (12) month term unless Tenant gives Landlord written notice of non-renewal at least ninety (90) days before the end of the term.",
      ],
    },
    {
      heading: "11. LIABILITY",
      paragraphs: [
        "Landlord shall not be liable for any injury, loss, or damage to Tenant or Tenant's property from any cause, including water leaks, and Tenant agrees to hold Landlord harmless from all such claims.",
      ],
    },
    {
      heading: "12. ATTORNEY'S FEES",
      paragraphs: [
        "If Landlord brings any action to enforce this Lease, Tenant shall pay Landlord's reasonable attorney's fees and court costs.",
      ],
    },
    {
      heading: "13. JOINT RESPONSIBILITY",
      paragraphs: [
        "If more than one person signs this Lease as Tenant, each is jointly and severally liable for all obligations under this Lease.",
      ],
    },
    {
      heading: "14. ENTIRE AGREEMENT",
      paragraphs: [
        "This Lease is the entire agreement between the parties. Any change must be in writing and signed by both parties.",
        "Landlord: ______________________   Tenant: ______________________   Tenant: ______________________",
      ],
    },
  ],
};

export const SAMPLE_B: SampleLease = {
  id: "sample-b",
  fileName: "fineprint-sample-lease-b.pdf",
  title: "RESIDENTIAL LEASE",
  subtitle: BANNER,
  summary: "Cleaner lease: $2,100 rent, deposit equal to one month, landlord handles repairs, no extra fees.",
  preamble: [
    "This Lease is between Fairmount Rentals Trust (\"Landlord\") and Casey Placeholder (\"Tenant\"). All names in this document are fictional.",
    "Premises: 200 Sample Avenue, Apartment 2B, Cambridge, Massachusetts 02139 (a fictional address).",
  ],
  sections: [
    {
      heading: "1. TERM",
      paragraphs: ["The term of this Lease begins on June 1, 2026 and ends on May 31, 2027."],
    },
    {
      heading: "2. RENT",
      paragraphs: ["Tenant shall pay rent of $2,100.00 per month, due on the first day of each month."],
    },
    {
      heading: "3. MOVE-IN PAYMENTS",
      paragraphs: [
        "Before move-in, Tenant shall pay: (a) first month's rent of $2,100.00; (b) last month's rent of $2,100.00; (c) a security deposit of $2,100.00; and (d) the cost of a new lock and key, $50.00.",
        "Landlord will give Tenant a receipt for the security deposit and last month's rent, and a statement of the condition of the Premises.",
      ],
    },
    {
      heading: "4. LATE RENT",
      paragraphs: ["If rent remains unpaid thirty (30) days after its due date, Tenant shall pay a late charge of $50.00."],
    },
    {
      heading: "5. UTILITIES",
      paragraphs: [
        "Landlord shall provide heat, hot water, and water at no additional charge. Tenant shall pay for electricity and internet service, which are separately metered for the Premises.",
      ],
    },
    {
      heading: "6. REPAIRS",
      paragraphs: [
        "Landlord shall maintain the Premises in good repair and in compliance with the State Sanitary Code. Tenant shall be responsible for the cost of repairing damage caused by Tenant or Tenant's guests beyond normal wear and tear.",
      ],
    },
    {
      heading: "7. ENDING THE TENANCY",
      paragraphs: [
        "Either party may give written notice of termination at least thirty (30) days before the end of the term. Tenant may sublet with Landlord's written consent, which shall not be unreasonably withheld.",
      ],
    },
    {
      heading: "8. ENTIRE AGREEMENT",
      paragraphs: [
        "This Lease is the entire agreement between the parties.",
        "Landlord: ______________________   Tenant: ______________________",
      ],
    },
  ],
};

export const SAMPLE_LEASES = { "sample-a": SAMPLE_A, "sample-b": SAMPLE_B } as const;
export type SampleId = keyof typeof SAMPLE_LEASES;

export function isSampleId(v: unknown): v is SampleId {
  return v === "sample-a" || v === "sample-b";
}

export function samplePdfUrl(id: SampleId): string {
  return `/samples/${SAMPLE_LEASES[id].fileName}`;
}

/** Plain-text rendering, ~5 sections per page. Used by fixture/preview mode. */
export function sampleToDocument(sample: SampleLease): LeaseDocument {
  const chunks: string[] = [];
  let current = [sample.title, sample.subtitle, "", ...sample.preamble, ""].join("\n");
  sample.sections.forEach((s, i) => {
    current += `\n${s.heading}\n${s.paragraphs.join("\n\n")}\n`;
    if ((i + 1) % 5 === 0) {
      chunks.push(current);
      current = "";
    }
  });
  if (current.trim()) chunks.push(current);
  const pages = chunks.map((t, i) => buildPageFromText(i + 1, t));
  return {
    id: `fixture-${sample.id}`,
    fileName: sample.fileName,
    source: "fixture",
    pageCount: pages.length,
    pages,
    hasExtractableText: true,
  };
}
