import type { LegalSource, ResearchTopicId } from "@/types/lease";

/**
 * BUNDLED REFERENCE MATERIAL — NOT A LIVE SEARCH.
 *
 * Verbatim excerpts of Massachusetts General Laws, Chapter 186, captured by the
 * FinePrint developers directly from malegislature.gov on the date below. They
 * are used only when live Tavily research is unavailable or when the app runs in
 * demo mode, and every UI surface labels them as bundled reference data.
 *
 * Law changes. These excerpts can become outdated; always confirm on the
 * official site before relying on them.
 */
export const BUNDLED_CAPTURED_AT = "2026-11-07T00:00:00.000Z";

const MGL = "https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186";

function src(
  topicId: ResearchTopicId,
  section: string,
  title: string,
  excerpt: string,
): LegalSource {
  return {
    title: `M.G.L. c. 186, § ${section} — ${title}`,
    url: `${MGL}/Section${section}`,
    excerpt,
    retrievedAt: BUNDLED_CAPTURED_AT,
    topicId,
    sourceType: "statute",
    isOfficial: true,
    origin: "bundled",
  };
}

const S15B_UPFRONT =
  "(b) At or prior to the commencement of any tenancy, no lessor or agent of the lessor may require a tenant or prospective tenant to pay, to the lessor or to an agent of the lessor, any amount in excess of the following: (i) rent for the first full month of occupancy; and, (ii) rent for the last full month of occupancy calculated at the same rate as the first month; and, (iii) a security deposit equal to the first month's rent provided that such security deposit is deposited as required by subsection (3) and that the tenant is given the statement of condition as required by subsection (2); … and, (iv) the purchase and installation cost for a key and lock.";

export const BUNDLED_SOURCES: Record<ResearchTopicId, LegalSource[]> = {
  "ma-security-deposit-limits": [
    src("ma-security-deposit-limits", "15B", "Security deposits; payments at commencement of tenancy", S15B_UPFRONT),
    src(
      "ma-security-deposit-limits",
      "15B",
      "Security deposits; payments at commencement of tenancy",
      "(d) No lessor or successor in interest shall at any time subsequent to the commencement of a tenancy demand rent in advance in excess of the current month's rent or a security deposit in excess of the amount allowed by this section.",
    ),
  ],
  "ma-upfront-charges": [
    src("ma-upfront-charges", "15B", "Security deposits; payments at commencement of tenancy", S15B_UPFRONT),
  ],
  "ma-late-fees": [
    src(
      "ma-late-fees",
      "15B",
      "Security deposits; payments at commencement of tenancy",
      "(c) No lease or other rental agreement shall impose any interest or penalty for failure to pay rent until thirty days after such rent shall have been due.",
    ),
  ],
  "ma-repair-obligations": [
    src(
      "ma-repair-obligations",
      "19",
      "Notice to landlord of unsafe condition",
      "A landlord or lessor of any real estate except an owner-occupied two- or three-family dwelling shall, within a reasonable time following receipt of a written notice from a tenant forwarded by registered or certified mail of an unsafe condition, not caused by the tenant, his invitee, or any one occupying through or under the tenant, exercise reasonable care to correct the unsafe condition described in said notice … Any waiver of this provision in any lease or other rental agreement for residential use shall be void and unenforceable.",
    ),
  ],
  "ma-utilities-billing": [
    src(
      "ma-utilities-billing",
      "22",
      "Water submetering; water use charges",
      "(c) A landlord may charge a tenant of a dwelling unit for water usage as measured through the use of submetering equipment only in accordance with this section and only upon the landlord certifying that the dwelling unit is in compliance with this section to a board of health, health department or other municipal agency or department charged with enforcement of the state sanitary code. All provisions of this section allowing landlords to charge tenants for water usage shall also be deemed to apply to sewer service charges calculated by means of the same primary meter or submeter.",
    ),
    src(
      "ma-utilities-billing",
      "14",
      "Wrongful acts of landlord; utilities and services",
      "Any lessor or landlord … who transfers the responsibility for payment for any utility services to the occupant without his knowledge or consent … shall be punished by a fine …",
    ),
  ],
  "ma-termination-notice": [
    src(
      "ma-termination-notice",
      "12",
      "Notice to determine estate at will",
      "Estates at will may be determined by either party by three months' notice in writing for that purpose given to the other party; and, if the rent reserved is payable at periods of less than three months, the time of such notice shall be sufficient if it is equal to the interval between the days of payment or thirty days, whichever is longer.",
    ),
  ],
  // No verified bundled excerpt is shipped for automatic renewal. Live research is required.
  "ma-lease-renewal": [],
  "ma-landlord-liability-waiver": [
    src(
      "ma-landlord-liability-waiver",
      "15",
      "Non-liability of landlord; provisions in lease",
      "Any provision of a lease or other rental agreement relating to real property whereby a lessee or tenant enters into a covenant, agreement or contract, by the use of any words whatsoever, the effect of which is to indemnify the lessor or landlord or hold the lessor or landlord harmless, or preclude or exonerate the lessor or landlord from any or all liability to the lessee or tenant, or to any other person, for any injury, loss, damage or liability arising from any omission, fault, negligence or other misconduct of the lessor or landlord on or about the leased or rented premises … shall be deemed to be against public policy and void.",
    ),
  ],
  "ma-attorney-fees": [
    src(
      "ma-attorney-fees",
      "20",
      "Attorneys' fees; residential lease provisions; implied covenant",
      "Whenever a lease of residential property shall provide that in any action or summary proceeding the landlord may recover attorneys' fees and expenses incurred as the result of the failure of the tenant to perform any covenant or agreement contained in such lease … there shall be implied in such lease a covenant by the landlord to pay to the tenant the reasonable attorneys' fees and expenses incurred by the tenant as the result of the failure of the landlord to perform any covenant or agreement on its part … Any waiver of this section shall be void as against public policy.",
    ),
  ],
};

export function getBundledSources(topicId: ResearchTopicId): LegalSource[] {
  return BUNDLED_SOURCES[topicId] ?? [];
}
