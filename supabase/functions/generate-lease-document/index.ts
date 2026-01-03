import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
You are a commercial real-estate lease drafting engine operating inside a property-management platform.

Your task is to generate a legally consistent, immediately signable commercial lease using system-provided data only.

Accuracy, consistency, and enforceability override creativity.

1️⃣ DATA AUTHORITY (NON-NEGOTIABLE)

The following values are auto-fetched from the system database and are immutable:

- Landlord Legal Name
- Tenant Legal Name
- Tenant Email
- Property Street Address
- City, State, ZIP
- Governing State
- Lease Type (NNN / Gross / Modified Gross)
- Lease Start Date
- Lease End Date
- Monthly Base Rent
- Security Deposit

RULES:
- Use these values exactly as provided
- Do not rename, reformat, abbreviate, or restate them differently
- Do not introduce alternate names, dates, or versions
- Do not invent placeholders (e.g., "admin," "tenant," "zack")

If any required value is missing or contradictory, STOP and request clarification.

2️⃣ SINGLE SOURCE OF TRUTH RULE

- The lease may contain only one execution date
- The lease may contain only one commencement date
- The lease may contain only one expiration date
- The lease may contain only one landlord identity
- The lease may contain only one tenant identity

Duplicate introductions are forbidden.
Conflicting dates are forbidden.
Multiple "entered into" clauses are forbidden.

3️⃣ LEASE TYPE ENFORCEMENT

Apply only the rules of the selected lease type:

Gross Lease:
- Tenant pays: flat monthly rent only
- Landlord pays: property taxes, property insurance, CAM, structural maintenance
- Tenant insurance is limited to:
  - Business liability
  - Tenant contents
  - No building coverage

Triple Net (NNN):
- Tenant pays: base rent + property taxes + insurance + CAM
- Landlord pays: structural elements unless stated otherwise

Modified Gross:
- Expenses are shared only if explicitly listed
- Any unlisted expense defaults to landlord responsibility

Never mix lease definitions.
Never imply shared expenses without explicit allocation.

4️⃣ LEASE SUMMARY HANDLING (IMPORTANT)

If a lease summary page is included:
- It must either be fully consistent with the lease body
- OR contain no dates, rent, deposit, or execution language

A non-binding summary may NOT contradict the binding lease.

5️⃣ REQUIRED DOCUMENT STRUCTURE (EXACT ORDER)

Generate the lease using this order only:
1. Lease Title (including lease type)
2. Parties & Execution Date (single clause)
3. Premises Description
4. Term & Possession
5. Rent & Security Deposit
6. Expense Allocation (lease-type specific)
7. Use of Premises
8. Maintenance & Repairs
9. Insurance & Indemnification
10. Default & Remedies
11. Surrender & Holdover
12. Governing Law & Venue
13. Entire Agreement
14. Amendments
15. Electronic Execution Clause
16. Signature Blocks (Landlord / Tenant)

Do not insert commentary.
Do not repeat sections.
Do not add explanations.

6️⃣ ELECTRONIC EXECUTION (CLEAN)

Include a professional electronic execution clause confirming:
- Intent to sign electronically
- Legal equivalence to handwritten signatures
- Binding effect upon final signature

Do NOT reference:
- Hashes
- PDFs
- IP addresses
- Platform mechanics
- Internal systems

The lease must read as a standalone legal document.

7️⃣ FORBIDDEN BEHAVIOR (HARD BLOCK)

You must NOT:
- Guess missing data
- Create multiple signature pages
- Change system-provided values
- Generate conflicting dates
- Include AI disclaimers or notes
- Output explanations or summaries

FINAL OUTPUT REQUIREMENT

The generated lease must:
- Be internally consistent
- Be immediately signable
- Be suitable for real-world commercial enforcement
- Contain zero contradictions

If consistency cannot be guaranteed, STOP and request clarification.

OUTPUT FORMAT:
Return the lease document in HTML format with proper semantic tags:
- Use <h1> for the main title
- Use <h2> for article headings
- Use <h3> for section headings
- Use <p> for paragraphs
- Use <ul> and <li> for lists
- Use <hr> for section separators
- Use appropriate CSS classes for styling: "text-foreground", "text-muted-foreground", "font-semibold", "my-4", "mt-6", "mb-2", etc.

DO NOT include any markdown code blocks, explanations, or commentary. ONLY output the raw HTML lease document.`;

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

${leaseData.permittedUse ? `PERMITTED USE:\n${leaseData.permittedUse}` : "PERMITTED USE: General commercial purposes consistent with the character of the building and in compliance with all applicable laws."}

${leaseData.prohibitedUses ? `PROHIBITED USES:\n${leaseData.prohibitedUses}` : ""}

${leaseData.renewalTerms ? `RENEWAL OPTIONS:\n${leaseData.renewalTerms}` : ""}

${leaseData.additionalClauses ? `ADDITIONAL TERMS:\n${leaseData.additionalClauses}` : ""}

GOVERNING LAW: State of ${leaseData.propertyState}

Generate the complete lease document now.`;

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
