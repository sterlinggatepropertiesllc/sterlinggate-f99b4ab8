import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo.png';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Sterling Gate Properties" className="h-16 w-auto object-contain" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-serif mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last Updated: January 3, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-serif mb-4">1. Introduction and Scope</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Sterling Gate Properties ("Company," "we," "us," or "our") is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy describes how we collect, use, disclose, store, and protect your personal information when you use our commercial property management platform, website, mobile applications, and related services (collectively, the "Services").
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              This Privacy Policy applies to all users of our Services, including prospective tenants, current tenants, property managers, property owners, vendors, contractors, and any other individuals who interact with our platform. By accessing or using our Services, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy. If you do not agree with our policies and practices, please do not use our Services.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify this Privacy Policy at any time. Any changes will be effective immediately upon posting the updated Privacy Policy on our website. Your continued use of the Services after any modifications indicates your acceptance of the modified Privacy Policy. We encourage you to review this Privacy Policy periodically for any updates.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-medium mb-3">2.1 Personal Identification Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We collect personal identification information that you voluntarily provide to us when you register for an account, submit a rental application, sign a lease agreement, or otherwise interact with our Services. This information may include, but is not limited to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Full legal name, including any aliases or former names</li>
              <li>Date of birth and age verification information</li>
              <li>Social Security Number or Tax Identification Number</li>
              <li>Government-issued identification documents (driver's license, state ID, passport)</li>
              <li>Current and previous residential addresses</li>
              <li>Email addresses and phone numbers</li>
              <li>Emergency contact information</li>
              <li>Immigration status and work authorization documents (where legally required)</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">2.2 Financial and Employment Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To process rental applications and assess tenant eligibility, we collect financial and employment information, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Current and previous employer information, including employer name, address, and contact information</li>
              <li>Employment history and duration of employment</li>
              <li>Job title, position, and employment status (full-time, part-time, contract)</li>
              <li>Monthly and annual gross income</li>
              <li>Bank account information and banking history</li>
              <li>Cash on hand and liquid asset information</li>
              <li>Credit history and credit scores obtained from consumer reporting agencies</li>
              <li>Rental payment history from previous landlords</li>
              <li>Outstanding debts, liens, judgments, and bankruptcy information</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">2.3 Sensitive Documents and Verification Materials</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              As part of our verification and application processes, we may collect copies of sensitive documents, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Front and back images of government-issued driver's licenses or state identification cards</li>
              <li>Social Security cards (front image only)</li>
              <li>Passport photographs and identification pages</li>
              <li>Pay stubs, W-2 forms, and tax returns</li>
              <li>Bank statements and proof of funds</li>
              <li>Proof of insurance documentation</li>
              <li>Business licenses and entity formation documents (for commercial tenants)</li>
              <li>Electronic signatures and signature images</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">2.4 Background Check Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              With your explicit consent, we obtain background check information from third-party consumer reporting agencies, which may include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Criminal history records, including arrests, convictions, and pending charges</li>
              <li>Sex offender registry information</li>
              <li>Eviction history and landlord-tenant court records</li>
              <li>Credit reports and credit scores</li>
              <li>Employment verification results</li>
              <li>Identity verification results</li>
              <li>Terrorist watch list and sanctions screenings</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">2.5 Usage and Technical Information</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We automatically collect certain technical information when you access our Services, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>IP addresses, device identifiers, and browser types</li>
              <li>Operating system and device information</li>
              <li>Pages visited, links clicked, and navigation patterns</li>
              <li>Date, time, and duration of visits</li>
              <li>Referring URLs and search terms</li>
              <li>Location data based on IP address or GPS (with permission)</li>
              <li>Cookies, web beacons, and similar tracking technologies</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">2.6 Communication Records</h3>
            <p className="text-muted-foreground leading-relaxed">
              We maintain records of all communications between you and our platform, including messages sent through our messaging system, emails, phone calls (which may be recorded for quality assurance), and any other correspondence related to your tenancy or use of our Services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect for various purposes, including but not limited to:
            </p>
            
            <h3 className="text-xl font-medium mb-3">3.1 Application Processing and Tenant Screening</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Evaluating rental applications and determining tenant eligibility</li>
              <li>Conducting background checks, credit checks, and employment verification</li>
              <li>Verifying identity and preventing fraud</li>
              <li>Contacting references and previous landlords</li>
              <li>Making informed leasing decisions</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">3.2 Lease Management and Property Operations</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Creating, executing, and managing lease agreements</li>
              <li>Processing rent payments and managing tenant accounts</li>
              <li>Tracking security deposits and other financial transactions</li>
              <li>Managing maintenance requests and property repairs</li>
              <li>Enforcing lease terms and property rules</li>
              <li>Conducting move-in and move-out inspections</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">3.3 Communication and Customer Service</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Responding to inquiries and providing customer support</li>
              <li>Sending important notices regarding your tenancy</li>
              <li>Providing updates about property maintenance and emergencies</li>
              <li>Sending reminders about rent payments and lease renewals</li>
              <li>Conducting surveys and gathering feedback</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">3.4 Legal and Compliance Purposes</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Complying with applicable laws, regulations, and legal processes</li>
              <li>Responding to subpoenas, court orders, and government requests</li>
              <li>Enforcing our terms of service and protecting our legal rights</li>
              <li>Defending against legal claims and disputes</li>
              <li>Maintaining records as required by law</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">3.5 Business Operations and Analytics</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Analyzing usage patterns and improving our Services</li>
              <li>Developing new features and functionality</li>
              <li>Conducting market research and business planning</li>
              <li>Generating aggregate statistics and reports</li>
              <li>Detecting and preventing fraud, abuse, and security threats</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">4. Information Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may share your personal information with the following categories of recipients:
            </p>

            <h3 className="text-xl font-medium mb-3">4.1 Property Owners and Managers</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We share relevant tenant information with property owners, property managers, and their authorized representatives who need access to such information to manage properties and make leasing decisions.
            </p>

            <h3 className="text-xl font-medium mb-3">4.2 Service Providers and Vendors</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We engage third-party service providers to perform various functions on our behalf, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Payment processors (e.g., Stripe) for handling financial transactions</li>
              <li>Background check providers and consumer reporting agencies</li>
              <li>Cloud storage and hosting providers</li>
              <li>Email and communication service providers</li>
              <li>Analytics and data processing services</li>
              <li>Customer support and help desk services</li>
              <li>Document management and e-signature providers</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">4.3 Legal and Regulatory Authorities</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may disclose your information to government agencies, law enforcement, courts, and regulatory bodies when required by law or when we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
            </p>

            <h3 className="text-xl font-medium mb-3">4.4 Business Transfers</h3>
            <p className="text-muted-foreground leading-relaxed">
              In the event of a merger, acquisition, bankruptcy, or sale of all or a portion of our assets, your personal information may be transferred to the acquiring entity or successor organization.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We implement comprehensive security measures designed to protect your personal information from unauthorized access, disclosure, alteration, and destruction. Our security practices include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>256-bit AES encryption for data at rest and in transit</li>
              <li>TLS/SSL protocols for secure data transmission</li>
              <li>Multi-factor authentication for account access</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls and role-based permissions</li>
              <li>Employee training on data protection and privacy</li>
              <li>Incident response and breach notification procedures</li>
              <li>Physical security measures for data center facilities</li>
              <li>Regular backup and disaster recovery procedures</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              While we strive to protect your personal information, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security, but we are committed to implementing industry-standard security practices.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We retain your personal information for as long as necessary to fulfill the purposes for which it was collected, including to satisfy legal, accounting, or reporting requirements. Our retention periods are determined based on:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>The duration of our ongoing relationship with you</li>
              <li>Legal obligations requiring data retention</li>
              <li>Statute of limitations for potential legal claims</li>
              <li>Business purposes such as maintaining records and analytics</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              Generally, we retain application materials for seven (7) years following the application decision, lease-related documents for seven (7) years after lease termination, and financial records for seven (7) years as required by tax and accounting regulations. Sensitive identity documents may be retained for the duration of your tenancy plus three (3) years.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">7. Your Rights and Choices</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Depending on your jurisdiction, you may have certain rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information, subject to legal retention requirements</li>
              <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
              <li><strong>Opt-out:</strong> Opt-out of certain data processing activities, such as marketing communications</li>
              <li><strong>Withdraw Consent:</strong> Withdraw previously given consent for specific processing activities</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              To exercise any of these rights, please contact us using the information provided in the Contact section below. We may require verification of your identity before processing your request.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">8. California Privacy Rights (CCPA/CPRA)</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act (CPRA), including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>The right to know what personal information we collect, use, disclose, and sell</li>
              <li>The right to request deletion of your personal information</li>
              <li>The right to opt-out of the sale or sharing of your personal information</li>
              <li>The right to non-discrimination for exercising your privacy rights</li>
              <li>The right to correct inaccurate personal information</li>
              <li>The right to limit the use of sensitive personal information</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information. To submit a request, please contact us using the information below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">9. Cookies and Tracking Technologies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use cookies, web beacons, and similar tracking technologies to enhance your experience, analyze usage patterns, and deliver personalized content. Types of cookies we use include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li><strong>Essential Cookies:</strong> Required for basic website functionality</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how you use our Services</li>
              <li><strong>Marketing Cookies:</strong> Used for targeted advertising (with consent)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              You can manage cookie preferences through your browser settings or our cookie consent tool.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children under 18. If you believe we have collected information from a child under 18, please contact us immediately, and we will take steps to delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">11. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your personal information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that are different from those in your country. We take appropriate safeguards to ensure that your personal information remains protected in accordance with this Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">12. Third-Party Links and Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Services may contain links to third-party websites and services. We are not responsible for the privacy practices of these third parties. We encourage you to review the privacy policies of any third-party sites or services before providing your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">13. Updates to This Privacy Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices or applicable laws. We will notify you of any material changes by posting the updated Privacy Policy on our website and updating the "Last Updated" date. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">14. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="bg-secondary/50 rounded-lg p-6 text-muted-foreground">
              <p className="font-medium text-foreground mb-2">Sterling Gate Properties</p>
              <p>Privacy Office</p>
              <p>Email: privacy@sterlinggate.com</p>
              <p>Phone: (555) 123-4567</p>
              <p className="mt-4">
                For California residents, you may also submit requests through our online privacy request form or by calling our toll-free privacy hotline.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">15. Dispute Resolution</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have a complaint about our privacy practices, please contact us first to resolve the issue. If we cannot resolve your complaint, you may have the right to file a complaint with your local data protection authority or seek other remedies available under applicable law.
            </p>
          </section>
        </div>

        {/* Back to top */}
        <div className="mt-12 pt-8 border-t border-border">
          <Link to="/">
            <Button variant="outline" className="btn-outline-silver">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-background">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            © 2026 Sterling Gate Properties. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}