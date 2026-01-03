import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TenantInsurance {
  generalLiabilityCoverage: number;
  landlordAsAdditionalInsured: boolean;
  coiRequiredBeforePossession: boolean;
  annualProofRequired: boolean;
  cancellationNoticeDays: number;
}

interface LeaseGenerationRequest {
  leaseType: "triple_net" | "gross" | "modified_gross";
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  landlordName: string;
  landlordEmail: string;
  landlordEntityType: "individual" | "llc" | "corporation";
  landlordStateOfFormation?: string;
  tenantName: string;
  tenantEmail: string;
  tenantEntityType: "individual" | "llc" | "corporation";
  tenantStateOfFormation?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  camCharges?: number;
  propertyTaxResponsibility: "landlord" | "tenant" | "shared";
  insuranceResponsibility: "landlord" | "tenant" | "both";
  rentDueDay: number;
  lateAfterDay: number;
  lateFeeType: string;
  lateFeePercentage: number;
  lateFeeFlatAmount: number;
  lateFeeDailyAmount: number;
  lateFeeMaxAmount?: number;
  renewalTerms?: string;
  additionalClauses?: string;
  permittedUse?: string;
  prohibitedUses?: string;
  guarantorName?: string;
  noticeAddressLandlord?: string;
  noticeAddressTenant?: string;
  emailNoticesPermitted?: boolean;
  // Tenant insurance (MANDATORY)
  tenantInsurance?: TenantInsurance;
  // Renewal options
  renewalOptionCount?: number;
  renewalOptionYears?: number;
  renewalOptionBasis?: "fixed_increase" | "market_rate";
  renewalOptionIncrease?: number;
  // Holdover rate
  holdoverRateMultiplier?: number;
}

interface ValidationIssue {
  field: string;
  message: string;
  step: number;
  stepName: string;
}

// Helper to check if a name looks like a placeholder
function isPlaceholderName(name: string): boolean {
  const placeholders = ['admin', 'tenant', 'user', 'test', 'landlord', 'owner', 'manager', 'unknown'];
  const lower = name.toLowerCase().trim();
  return placeholders.includes(lower) || lower.length < 3;
}

// Helper to check if name is a "full legal name" (at least 2 words)
function isFullLegalName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 && parts.every(p => p.length >= 2);
}

// Validate the lease data and return issues
function validateLeaseData(data: LeaseGenerationRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check landlord name
  if (!data.landlordName || data.landlordName.trim().length < 3) {
    issues.push({
      field: 'landlordLegalName',
      message: 'Landlord legal name is required',
      step: 0,
      stepName: 'Select Tenant'
    });
  } else if (isPlaceholderName(data.landlordName)) {
    issues.push({
      field: 'landlordLegalName',
      message: `"${data.landlordName}" is not a valid legal name. Please enter the landlord's full legal name.`,
      step: 0,
      stepName: 'Select Tenant'
    });
  } else if (!isFullLegalName(data.landlordName) && data.landlordEntityType === 'individual') {
    issues.push({
      field: 'landlordLegalName',
      message: `Please enter the landlord's full legal name (first and last name), not just "${data.landlordName}".`,
      step: 0,
      stepName: 'Select Tenant'
    });
  }

  // Check tenant name
  if (!data.tenantName || data.tenantName.trim().length < 3) {
    issues.push({
      field: 'tenantName',
      message: 'Tenant legal name is required',
      step: 0,
      stepName: 'Select Tenant'
    });
  } else if (isPlaceholderName(data.tenantName)) {
    issues.push({
      field: 'tenantName',
      message: `"${data.tenantName}" is not a valid legal name. Please enter the tenant's full legal name.`,
      step: 0,
      stepName: 'Select Tenant'
    });
  } else if (!isFullLegalName(data.tenantName) && data.tenantEntityType === 'individual') {
    issues.push({
      field: 'tenantName',
      message: `Please enter the tenant's full legal name (first and last name), not just "${data.tenantName}".`,
      step: 0,
      stepName: 'Select Tenant'
    });
  }

  // Check guarantor if entity tenant
  if (data.tenantEntityType !== 'individual' && !data.guarantorName) {
    issues.push({
      field: 'guarantorName',
      message: 'A personal guarantor is required when the tenant is a legal entity (LLC or Corporation).',
      step: 0,
      stepName: 'Select Tenant'
    });
  }

  // Check property address
  if (!data.propertyAddress || data.propertyAddress.trim().length < 5) {
    issues.push({
      field: 'propertyAddress',
      message: 'Property address is required',
      step: 1,
      stepName: 'Select Property'
    });
  }

  // Check dates
  if (!data.startDate) {
    issues.push({
      field: 'startDate',
      message: 'Lease start date is required',
      step: 3,
      stepName: 'Lease Terms'
    });
  }
  if (!data.endDate) {
    issues.push({
      field: 'endDate',
      message: 'Lease end date is required',
      step: 3,
      stepName: 'Lease Terms'
    });
  }
  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (end <= start) {
      issues.push({
        field: 'endDate',
        message: 'End date must be after start date',
        step: 3,
        stepName: 'Lease Terms'
      });
    }
  }

  // Check rent
  if (!data.monthlyRent || data.monthlyRent <= 0) {
    issues.push({
      field: 'monthlyRent',
      message: 'Monthly rent must be greater than $0',
      step: 3,
      stepName: 'Lease Terms'
    });
  }

  // MANDATORY: Check tenant insurance (critical for landlord-protective leases)
  if (!data.tenantInsurance || !data.tenantInsurance.generalLiabilityCoverage || data.tenantInsurance.generalLiabilityCoverage <= 0) {
    issues.push({
      field: 'tenantInsurance',
      message: 'Tenant General Liability insurance coverage amount is REQUIRED for commercial leases.',
      step: 4,
      stepName: 'Insurance & Notices'
    });
  }

  return issues;
}

// Check if content is valid HTML lease document
function isValidLeaseHTML(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  
  const trimmed = content.trim().toLowerCase();
  
  // Must contain basic HTML structure
  const hasHTMLTags = content.includes('<') && content.includes('>');
  
  // Must have a heading (title)
  const hasHeading = /<h[1-3][^>]*>/i.test(content);
  
  // Must have paragraphs
  const hasParagraphs = /<p[^>]*>/i.test(content);
  
  // Should NOT start with error messages
  const startsWithError = trimmed.startsWith('lease generation error') || 
                          trimmed.startsWith('error:') ||
                          trimmed.startsWith('i cannot') ||
                          trimmed.startsWith('i am unable');
  
  return hasHTMLTags && hasHeading && hasParagraphs && !startsWithError;
}

const SYSTEM_PROMPT = `SYSTEM ROLE
You are a commercial lease assembly engine inside a property-management platform.
Your purpose is to generate a LANDLORD-PROTECTIVE, commercially standard, multi-year gross lease using ONLY verified system inputs.

🚨 ABSOLUTE DATA LOCK (NON-NEGOTIABLE)

The following values are injected by the system and are LEGALLY FINAL:
- Landlord Legal Name (system-locked)
- Tenant Legal Name (system-locked)
- Tenant Email (system-locked)
- Property Full Address
- Governing State
- Lease Type
- Lease Term Dates
- Rent and Deposit Amounts

🔐 HARD RULES:
- You are FORBIDDEN from redefining, renaming, or restating these values
- You are FORBIDDEN from guessing missing data
- If ANY required value is missing → STOP and request it
- Never create placeholders or test names

📄 DOCUMENT STRUCTURE (MANDATORY ORDER - Strict Compliance Required)

Generate ONLY the following sections, in this exact order:

1. TITLE
   - "COMMERCIAL GROSS LEASE AGREEMENT" (for gross)
   - "TRIPLE NET (NNN) LEASE AGREEMENT" (for triple_net)
   - "MODIFIED GROSS LEASE AGREEMENT" (for modified_gross)

2. PARTIES & EXECUTION (Single paragraph)
   - One definition per party
   - One effective date

3. PREMISES
   - Complete property address, city, state, ZIP

4. TERM, POSSESSION & CONDITION
   - Lease start date (Commencement Date)
   - Lease end date (Expiration Date)
   - Condition upon delivery

5. RENT & SECURITY DEPOSIT
   - Base rent amount and payment schedule
   - Security deposit amount
   - Late fee structure as provided
   - Grace period

6. EXPENSE ALLOCATION (Based on Lease Type)
   - Gross Lease: Landlord pays taxes, insurance, CAM, structure; tenant pays base rent only
   - Triple Net: Tenant pays rent + taxes + insurance + CAM
   - Modified Gross: As explicitly specified

7. USE OF PREMISES
   - Permitted use (as provided)
   - Prohibited uses (as provided)

8. MAINTENANCE & REPAIRS
   - Allocation per lease type
   - Tenant interior maintenance for Gross

9. INSURANCE REQUIREMENTS (MANDATORY - LANDLORD-PROTECTIVE)
   This section MUST include:
   - Tenant SHALL maintain Commercial General Liability insurance at the EXACT coverage amount provided
   - Landlord MUST be named as additional insured (if specified)
   - Tenant MUST provide Certificate of Insurance (COI) before taking possession (if specified)
   - Tenant MUST maintain coverage throughout the entire lease term
   - Annual proof of insurance required (if specified)
   - Tenant must provide notice of any policy cancellation (use provided days)
   - CRITICAL: FAILURE TO MAINTAIN INSURANCE CONSTITUTES A MATERIAL DEFAULT
   - Tenant insurance is LIMITED TO: Business liability, tenant contents and operations
   - Landlord is responsible for building insurance (structure and building systems)

10. INDEMNIFICATION
    - Tenant indemnifies landlord for tenant-caused damages
    - Mutual indemnification where applicable

11. DEFAULT & REMEDIES (LANDLORD-PROTECTIVE)
    MUST include these hard defaults:
    - Insurance lapse = MATERIAL DEFAULT
    - Rent payment failure after grace period = DEFAULT
    - Abandonment of premises = DEFAULT
    - Holdover without consent = DEFAULT
    - Landlord remedies are CUMULATIVE (all remedies may be exercised)

12. CASUALTY & CONDEMNATION

13. SURRENDER & HOLDOVER
    - Holdover rent = premium rate (use provided multiplier, default 150% of base rent)
    - Holdover does NOT create new tenancy

14. NOTICES
    - Landlord notice address (as provided or property address)
    - Tenant notice address (as provided or premises)
    - Email notices permitted (if specified)

15. GOVERNING LAW
    - State as provided

16. ENTIRE AGREEMENT

17. AMENDMENTS
    - Must be in writing signed by both parties

18. ELECTRONIC EXECUTION
    - Intent to sign electronically
    - Legal equivalence to handwritten signatures

19. SIGNATURE BLOCKS (ONLY TWO)
    - Landlord signature block
    - Tenant signature block

🚫 FORBIDDEN OUTPUT (HARD FAIL)
- No summaries at the end
- No duplicate headers or sections
- No AI commentary or explanations
- No certificates inside the lease body
- No restated party definitions
- No conflicting dates
- No placeholder data

OUTPUT FORMAT:
Return the lease document in clean HTML format:
- Use <h1> for the main title only
- Use <h2> for article/section headings
- Use <h3> for subsection headings if needed
- Use <p> for all paragraph content
- Use <ul> and <li> for lists where appropriate
- Use <hr> sparingly for major section breaks
- Apply Tailwind classes: "text-foreground", "text-muted-foreground", "font-semibold", "my-4", "mt-6", "mb-2"

ONLY output the raw HTML lease document. No markdown, no explanations.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const leaseData: LeaseGenerationRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service is not configured");
    }

    // Validate lease data first - return structured errors
    const validationIssues = validateLeaseData(leaseData);
    
    if (validationIssues.length > 0) {
      console.log("Validation issues found:", validationIssues);
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          type: "VALIDATION_ERROR",
          issues: validationIssues,
          message: `Please fix ${validationIssues.length} issue(s) before generating the lease document.`
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate NNN lease requirements
    if (leaseData.leaseType === "triple_net") {
      const nnnValid = 
        leaseData.propertyTaxResponsibility === "tenant" &&
        leaseData.insuranceResponsibility === "tenant";
      
      if (!nnnValid) {
        console.log("NNN lease validation failed - downgrading to modified_gross");
        leaseData.leaseType = "modified_gross";
      }
    }

    // Check for proration needs
    const startDay = new Date(leaseData.startDate).getDate();
    const needsProration = startDay !== 1;
    
    // Calculate lease duration
    const startDate = new Date(leaseData.startDate);
    const endDate = new Date(leaseData.endDate);
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const isShortTerm = durationDays < 30;

    // Build the user prompt with all lease data
    const userPrompt = `Generate a complete commercial lease agreement with the following details:

LEASE CONFIGURATION:
- Lease Type: ${leaseData.leaseType === "triple_net" ? "Triple Net (NNN)" : leaseData.leaseType === "gross" ? "Gross Lease" : "Modified Gross Lease"}
- Duration: ${durationDays} days (${isShortTerm ? "SHORT-TERM OCCUPANCY" : "Standard Term"})
- Proration Required: ${needsProration ? "YES - lease starts on day " + startDay : "NO"}

LANDLORD INFORMATION:
- Name: ${leaseData.landlordName}
- Email: ${leaseData.landlordEmail}
- Entity Type: ${leaseData.landlordEntityType || "individual"}
${leaseData.landlordStateOfFormation ? `- State of Formation: ${leaseData.landlordStateOfFormation}` : ""}
${leaseData.noticeAddressLandlord ? `- Notice Address: ${leaseData.noticeAddressLandlord}` : `- Notice Address: ${leaseData.propertyAddress}, ${leaseData.propertyCity}, ${leaseData.propertyState} ${leaseData.propertyZip}`}

TENANT INFORMATION:
- Name: ${leaseData.tenantName}
- Email: ${leaseData.tenantEmail}
- Entity Type: ${leaseData.tenantEntityType || "individual"}
${leaseData.tenantStateOfFormation ? `- State of Formation: ${leaseData.tenantStateOfFormation}` : ""}
${leaseData.noticeAddressTenant ? `- Notice Address: ${leaseData.noticeAddressTenant}` : ""}
${leaseData.tenantEntityType && leaseData.tenantEntityType !== "individual" && leaseData.guarantorName ? `- Personal Guarantor Required: ${leaseData.guarantorName}` : ""}

PREMISES:
- Address: ${leaseData.propertyAddress}
- City: ${leaseData.propertyCity}
- State: ${leaseData.propertyState}
- ZIP: ${leaseData.propertyZip}

TERM:
- Commencement Date: ${leaseData.startDate}
- Expiration Date: ${leaseData.endDate}

RENT:
- Base Monthly Rent: $${leaseData.monthlyRent.toLocaleString()}
- Security Deposit: $${leaseData.securityDeposit.toLocaleString()}
${leaseData.camCharges ? `- CAM Charges: $${leaseData.camCharges.toLocaleString()}/month` : ""}
- Rent Due: ${leaseData.rentDueDay}${leaseData.rentDueDay === 1 ? "st" : leaseData.rentDueDay === 2 ? "nd" : leaseData.rentDueDay === 3 ? "rd" : "th"} of each month
- Grace Period: Until ${leaseData.lateAfterDay}${leaseData.lateAfterDay === 1 ? "st" : leaseData.lateAfterDay === 2 ? "nd" : leaseData.lateAfterDay === 3 ? "rd" : "th"} of each month
- Late Fee Structure: ${leaseData.lateFeeType}
${leaseData.lateFeeFlatAmount ? `  - Flat Fee: $${leaseData.lateFeeFlatAmount}` : ""}
${leaseData.lateFeePercentage ? `  - Percentage: ${leaseData.lateFeePercentage}%` : ""}
${leaseData.lateFeeDailyAmount ? `  - Daily Fee: $${leaseData.lateFeeDailyAmount}/day` : ""}
${leaseData.lateFeeMaxAmount ? `  - Maximum Cap: $${leaseData.lateFeeMaxAmount}` : ""}

RESPONSIBILITIES:
- Property Taxes: ${leaseData.propertyTaxResponsibility}
- Insurance: ${leaseData.insuranceResponsibility}

TENANT INSURANCE REQUIREMENTS (MANDATORY):
${leaseData.tenantInsurance ? `
- General Liability Coverage: $${leaseData.tenantInsurance.generalLiabilityCoverage.toLocaleString()}
- Landlord Named as Additional Insured: ${leaseData.tenantInsurance.landlordAsAdditionalInsured ? "YES" : "NO"}
- Certificate of Insurance Required Before Possession: ${leaseData.tenantInsurance.coiRequiredBeforePossession ? "YES" : "NO"}
- Annual Proof of Insurance Required: ${leaseData.tenantInsurance.annualProofRequired ? "YES" : "NO"}
- Notice of Cancellation: ${leaseData.tenantInsurance.cancellationNoticeDays} days
- FAILURE TO MAINTAIN INSURANCE = MATERIAL DEFAULT
- Tenant insurance covers: Business liability, tenant contents and operations ONLY
- Landlord maintains: Building insurance (structure, building systems)
` : "- Standard commercial insurance requirements apply"}

RENEWAL OPTIONS:
${leaseData.renewalOptionCount && leaseData.renewalOptionCount > 0 ? `
- Number of Options: ${leaseData.renewalOptionCount}
- Length of Each Option: ${leaseData.renewalOptionYears} year(s)
- Rent Basis: ${leaseData.renewalOptionBasis === "fixed_increase" ? `Fixed ${leaseData.renewalOptionIncrease}% increase` : "Market rate at time of renewal"}
- 60 days written notice required to exercise option
` : "No renewal options"}

HOLDOVER:
- Holdover Rent Rate: ${leaseData.holdoverRateMultiplier || 150}% of base rent
- Holdover does NOT create a new tenancy

NOTICES:
- Landlord Notice Address: ${leaseData.noticeAddressLandlord || `${leaseData.propertyAddress}, ${leaseData.propertyCity}, ${leaseData.propertyState} ${leaseData.propertyZip}`}
- Tenant Notice Address: ${leaseData.noticeAddressTenant || "Premises address after possession"}
- Email Notices Permitted: ${leaseData.emailNoticesPermitted !== false ? "YES (in addition to written)" : "NO (written only)"}

${leaseData.permittedUse ? `PERMITTED USE:\n${leaseData.permittedUse}` : "PERMITTED USE: General commercial purposes consistent with the character of the building and in compliance with all applicable laws."}

${leaseData.prohibitedUses ? `PROHIBITED USES:\n${leaseData.prohibitedUses}` : ""}

${leaseData.additionalClauses ? `ADDITIONAL TERMS:\n${leaseData.additionalClauses}` : ""}

GOVERNING LAW: State of ${leaseData.propertyState}

Generate the complete landlord-protective lease document now.`;

    console.log("Calling Lovable AI to generate lease document...");
    console.log("Lease type:", leaseData.leaseType);
    console.log("Duration days:", durationDays);
    console.log("Needs proration:", needsProration);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    let leaseDocument = aiResponse.choices?.[0]?.message?.content;

    if (!leaseDocument) {
      console.error("No content in AI response");
      throw new Error("Failed to generate lease document");
    }

    // Clean up the response - remove any markdown code blocks if present
    leaseDocument = leaseDocument
      .replace(/```html\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    // Validate that the output is actually valid HTML lease document
    if (!isValidLeaseHTML(leaseDocument)) {
      console.error("AI returned invalid or error content:", leaseDocument.substring(0, 200));
      return new Response(
        JSON.stringify({
          error: "AI generated invalid content",
          type: "AI_ERROR",
          issues: [{
            field: 'general',
            message: 'The AI was unable to generate a valid lease document. This may be due to missing or invalid information. Please review all fields and try again.',
            step: 5,
            stepName: 'Preview Document'
          }],
          rawOutput: leaseDocument.substring(0, 500),
          message: "The AI could not generate a valid lease. Please check all inputs and try again."
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Lease document generated successfully");

    return new Response(
      JSON.stringify({ 
        leaseDocument,
        metadata: {
          generatedAt: new Date().toISOString(),
          leaseType: leaseData.leaseType,
          durationDays,
          proratedRent: needsProration,
          isShortTerm,
          hasGuaranty: leaseData.tenantEntityType !== "individual" && !!leaseData.guarantorName
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating lease document:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to generate lease document" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
