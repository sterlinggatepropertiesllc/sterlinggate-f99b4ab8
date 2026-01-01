// Legal Lease Templates for US Commercial Properties

export type LeaseType = 'triple_net' | 'gross' | 'modified_gross';

export type LateFeeType = 'flat' | 'percentage' | 'daily' | 'flat_plus_daily' | 'flat_plus_percentage' | 'percentage_plus_daily' | 'all';

export interface LeaseTerms {
  leaseType: LeaseType;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  landlordName: string;
  landlordEmail: string;
  tenantName: string;
  tenantEmail: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  camCharges?: number;
  propertyTaxResponsibility: 'landlord' | 'tenant' | 'shared';
  insuranceResponsibility: 'landlord' | 'tenant' | 'both';
  rentDueDay: number;
  lateAfterDay: number;
  lateFeeType: LateFeeType;
  lateFeePercentage: number;
  lateFeeFlatAmount: number;
  lateFeeDailyAmount: number;
  lateFeeMaxAmount?: number;
  renewalTerms?: string;
  additionalClauses?: string;
}

export const LEASE_TYPE_LABELS: Record<LeaseType, string> = {
  triple_net: 'Triple Net (NNN) Lease',
  gross: 'Gross Lease',
  modified_gross: 'Modified Gross Lease',
};

export const LEASE_TYPE_DESCRIPTIONS: Record<LeaseType, string> = {
  triple_net: 'Tenant pays base rent plus property taxes, insurance, and maintenance costs (CAM)',
  gross: 'Landlord pays all property expenses; tenant pays flat monthly rent',
  modified_gross: 'Expenses are shared between landlord and tenant as negotiated',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatDayOfMonth(day: number): string {
  return `${day}${getOrdinalSuffix(day)}`;
}

function generateLateFeeClause(terms: LeaseTerms): string {
  const dueDay = formatDayOfMonth(terms.rentDueDay);
  const lateAfterDay = formatDayOfMonth(terms.lateAfterDay);
  
  let clause = `Rent is due on the ${dueDay} of each month and is considered late after the ${lateAfterDay}. `;
  
  switch (terms.lateFeeType) {
    case 'flat':
      clause += `If payment is not received by the ${lateAfterDay}, a late charge of ${formatCurrency(terms.lateFeeFlatAmount)} will be assessed.`;
      break;
    case 'percentage':
      clause += `If payment is not received by the ${lateAfterDay}, a late charge equal to ${terms.lateFeePercentage}% of the overdue amount will be assessed.`;
      break;
    case 'daily':
      clause += `If payment is not received by the ${lateAfterDay}, a late charge of ${formatCurrency(terms.lateFeeDailyAmount)} per day will be assessed for each day the payment remains outstanding.`;
      break;
    case 'flat_plus_daily':
      clause += `If payment is not received by the ${lateAfterDay}, an initial late charge of ${formatCurrency(terms.lateFeeFlatAmount)} will be assessed, plus ${formatCurrency(terms.lateFeeDailyAmount)} for each additional day the payment remains outstanding.`;
      break;
    case 'flat_plus_percentage':
      clause += `If payment is not received by the ${lateAfterDay}, a late charge of ${formatCurrency(terms.lateFeeFlatAmount)} will be assessed, plus ${terms.lateFeePercentage}% of the overdue amount.`;
      break;
    case 'percentage_plus_daily':
      clause += `If payment is not received by the ${lateAfterDay}, a late charge equal to ${terms.lateFeePercentage}% of the overdue amount will be assessed, plus ${formatCurrency(terms.lateFeeDailyAmount)} for each additional day the payment remains outstanding.`;
      break;
    case 'all':
      clause += `If payment is not received by the ${lateAfterDay}, a late charge of ${formatCurrency(terms.lateFeeFlatAmount)} will be assessed, plus ${terms.lateFeePercentage}% of the overdue amount, plus ${formatCurrency(terms.lateFeeDailyAmount)} for each additional day the payment remains outstanding.`;
      break;
  }
  
  if (terms.lateFeeMaxAmount && terms.lateFeeMaxAmount > 0) {
    clause += ` Total late fees shall not exceed ${formatCurrency(terms.lateFeeMaxAmount)}.`;
  }
  
  clause += ` This late charge is in addition to any other remedies available to Landlord.`;
  
  return clause;
}

export function generateLeaseDocument(terms: LeaseTerms): string {
  const leaseTypeLabel = LEASE_TYPE_LABELS[terms.leaseType];
  
  return `
COMMERCIAL ${leaseTypeLabel.toUpperCase()}
================================================================================

This Commercial Lease Agreement ("Agreement") is entered into as of ${formatDate(terms.startDate)}
by and between:

LANDLORD:
${terms.landlordName}
Email: ${terms.landlordEmail}

("Landlord")

AND

TENANT:
${terms.tenantName}
Email: ${terms.tenantEmail}

("Tenant")

================================================================================
ARTICLE 1: PREMISES
================================================================================

Landlord hereby leases to Tenant, and Tenant hereby leases from Landlord, the
following described premises ("Premises"):

Address: ${terms.propertyAddress}
City: ${terms.propertyCity}
State: ${terms.propertyState}
ZIP Code: ${terms.propertyZip}

================================================================================
ARTICLE 2: TERM
================================================================================

2.1 LEASE TERM
The term of this Lease shall commence on ${formatDate(terms.startDate)} ("Commencement Date")
and shall expire on ${formatDate(terms.endDate)} ("Expiration Date"), unless sooner
terminated in accordance with the terms of this Lease.

${terms.renewalTerms ? `
2.2 RENEWAL OPTIONS
${terms.renewalTerms}
` : ''}

================================================================================
ARTICLE 3: RENT
================================================================================

3.1 BASE RENT
Tenant agrees to pay Landlord as base rent for the Premises the sum of
${formatCurrency(terms.monthlyRent)} per month ("Base Rent"), payable in advance on the
${formatDayOfMonth(terms.rentDueDay)} day of each calendar month during the Term.

3.2 SECURITY DEPOSIT
Upon execution of this Lease, Tenant shall deposit with Landlord the sum of
${formatCurrency(terms.securityDeposit)} as a security deposit ("Security Deposit"). The Security
Deposit shall be held by Landlord as security for the faithful performance by
Tenant of all terms, covenants, and conditions of this Lease.

${terms.leaseType === 'triple_net' && terms.camCharges ? `
3.3 ADDITIONAL RENT - CAM CHARGES
In addition to Base Rent, Tenant shall pay Common Area Maintenance charges
("CAM") in the amount of ${formatCurrency(terms.camCharges)} per month, which includes
Tenant's proportionate share of property taxes, insurance, and maintenance costs.
` : ''}

3.4 LATE PAYMENT
${generateLateFeeClause(terms)}

================================================================================
ARTICLE 4: USE OF PREMISES
================================================================================

4.1 PERMITTED USE
Tenant shall use the Premises only for lawful commercial purposes consistent
with the character of the building and in compliance with all applicable laws,
ordinances, and regulations.

4.2 PROHIBITED USES
Tenant shall not use the Premises for any illegal purpose, nor shall Tenant
cause or permit any nuisance or waste on the Premises.

================================================================================
ARTICLE 5: TAXES AND INSURANCE
================================================================================

5.1 PROPERTY TAXES
${terms.propertyTaxResponsibility === 'landlord' 
  ? 'Landlord shall be responsible for payment of all real property taxes and assessments levied against the Premises.'
  : terms.propertyTaxResponsibility === 'tenant'
  ? 'Tenant shall be responsible for payment of all real property taxes and assessments levied against the Premises as Additional Rent.'
  : 'Property taxes shall be shared equally between Landlord and Tenant.'}

5.2 INSURANCE
${terms.insuranceResponsibility === 'landlord'
  ? 'Landlord shall maintain property insurance covering the Premises. Tenant shall maintain liability insurance for their business operations.'
  : terms.insuranceResponsibility === 'tenant'
  ? 'Tenant shall maintain comprehensive property and liability insurance covering the Premises and their business operations.'
  : 'Landlord shall maintain property insurance. Tenant shall maintain liability insurance and contents coverage.'}

================================================================================
ARTICLE 6: MAINTENANCE AND REPAIRS
================================================================================

${terms.leaseType === 'triple_net' ? `
6.1 TENANT RESPONSIBILITIES
Under this Triple Net Lease, Tenant shall be responsible for all maintenance,
repairs, and replacements to the Premises, including but not limited to:
- Structural repairs
- HVAC systems
- Plumbing and electrical systems
- Roof and exterior walls
- Parking lots and landscaping
` : terms.leaseType === 'gross' ? `
6.1 LANDLORD RESPONSIBILITIES
Under this Gross Lease, Landlord shall be responsible for all maintenance,
repairs, and replacements to the Premises, including:
- Structural repairs
- HVAC systems
- Plumbing and electrical systems
- Roof and exterior walls
- Common areas

6.2 TENANT RESPONSIBILITIES
Tenant shall maintain the interior of the Premises in good condition and
repair any damage caused by Tenant's negligence.
` : `
6.1 SHARED RESPONSIBILITIES
Under this Modified Gross Lease, maintenance responsibilities are allocated
as follows:
- Landlord: Structural repairs, roof, exterior walls, common areas
- Tenant: Interior maintenance, HVAC filters, minor repairs under $500
`}

================================================================================
ARTICLE 7: DEFAULT AND REMEDIES
================================================================================

7.1 TENANT DEFAULT
The following shall constitute a default by Tenant:
(a) Failure to pay Rent after the ${formatDayOfMonth(terms.lateAfterDay)} of the month
(b) Failure to perform any other covenant within 30 days after written notice
(c) Abandonment of the Premises
(d) Filing of bankruptcy or insolvency proceedings

7.2 LANDLORD REMEDIES
Upon Tenant default, Landlord may:
(a) Terminate this Lease
(b) Re-enter and take possession of the Premises
(c) Pursue any legal remedies available

================================================================================
ARTICLE 8: GENERAL PROVISIONS
================================================================================

8.1 ENTIRE AGREEMENT
This Lease constitutes the entire agreement between the parties and supersedes
all prior negotiations, representations, and agreements.

8.2 AMENDMENTS
This Lease may not be amended except by written instrument signed by both parties.

8.3 GOVERNING LAW
This Lease shall be governed by and construed in accordance with the laws of
the State of ${terms.propertyState}.

8.4 NOTICES
All notices shall be in writing and delivered personally or sent by certified
mail to the addresses set forth above.

${terms.additionalClauses ? `
================================================================================
ARTICLE 9: ADDITIONAL TERMS AND CONDITIONS
================================================================================

${terms.additionalClauses}
` : ''}

================================================================================
SIGNATURES
================================================================================

IN WITNESS WHEREOF, the parties have executed this Lease as of the date first
written above.


LANDLORD:

_______________________________________     Date: _______________
${terms.landlordName}


TENANT:

_______________________________________     Date: _______________
${terms.tenantName}


================================================================================
DOCUMENT CERTIFICATION
================================================================================

This document is legally binding upon execution by both parties.
Document generated on: ${new Date().toISOString()}

`.trim();
}

export function generateLeaseHTML(terms: LeaseTerms): string {
  const content = generateLeaseDocument(terms);
  const lines = content.split('\n');
  
  return lines.map(line => {
    if (line.match(/^={5,}$/)) {
      return '<hr class="my-4 border-border" />';
    }
    if (line.match(/^ARTICLE \d+:/)) {
      return `<h2 class="text-lg font-semibold mt-6 mb-2 text-foreground">${line}</h2>`;
    }
    if (line.match(/^COMMERCIAL .+ LEASE$/)) {
      return `<h1 class="text-2xl font-bold text-center mb-4 text-foreground">${line}</h1>`;
    }
    if (line.match(/^(LANDLORD|TENANT|SIGNATURES|DOCUMENT CERTIFICATION):?$/)) {
      return `<h3 class="text-base font-semibold mt-4 mb-2 text-foreground">${line}</h3>`;
    }
    if (line.match(/^\d+\.\d+ [A-Z]/)) {
      return `<h4 class="font-medium mt-3 mb-1 text-foreground">${line}</h4>`;
    }
    if (line.trim().startsWith('(') || line.trim().startsWith('-')) {
      return `<p class="ml-4 text-muted-foreground">${line}</p>`;
    }
    if (line.trim() === '') {
      return '<br />';
    }
    return `<p class="text-muted-foreground leading-relaxed">${line}</p>`;
  }).join('\n');
}
