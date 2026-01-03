import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import logo from '@/assets/logo.png';

export default function TermsOfService() {
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
        <h1 className="text-4xl font-serif mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last Updated: January 3, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-serif mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Welcome to Sterling Gate Properties ("Company," "we," "us," or "our"). These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and Sterling Gate Properties governing your access to and use of our commercial property management platform, website, mobile applications, and all related services, features, content, and functionality (collectively, the "Services").
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              BY ACCESSING OR USING OUR SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE, OUR PRIVACY POLICY, AND ALL APPLICABLE LAWS AND REGULATIONS. IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST IMMEDIATELY DISCONTINUE USE OF OUR SERVICES.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              These Terms apply to all visitors, users, and others who access or use the Services, including prospective tenants, current tenants, property managers, property owners, vendors, contractors, and any authorized representatives thereof.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right, at our sole discretion, to modify, update, or revise these Terms at any time without prior notice. Any changes will be effective immediately upon posting on our website. Your continued use of the Services following the posting of revised Terms constitutes your acceptance of such changes. It is your responsibility to review these Terms periodically for updates. The date of the most recent revision will be indicated at the top of this document.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">2. Eligibility and Registration</h2>
            
            <h3 className="text-xl font-medium mb-3">2.1 Age and Legal Capacity</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You must be at least eighteen (18) years of age and possess the legal capacity to enter into binding contracts under applicable law to use our Services. By using our Services, you represent and warrant that you meet these eligibility requirements. If you are using the Services on behalf of a company, organization, or other legal entity, you represent and warrant that you have the authority to bind such entity to these Terms.
            </p>

            <h3 className="text-xl font-medium mb-3">2.2 Account Registration</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To access certain features of our Services, you must register for an account. When registering, you agree to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Provide accurate, current, and complete information as prompted by the registration form</li>
              <li>Maintain and promptly update your account information to keep it accurate, current, and complete</li>
              <li>Maintain the security and confidentiality of your login credentials</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Immediately notify us of any unauthorized use of your account or any other breach of security</li>
              <li>Not share your account credentials with any third party</li>
              <li>Not create more than one account per person unless expressly authorized</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your account, refuse any and all current or future use of the Services, or take other appropriate action in our sole discretion if we suspect that the information you provide is inaccurate, fraudulent, or incomplete, or if you violate any provision of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">3. Rental Application Process</h2>
            
            <h3 className="text-xl font-medium mb-3">3.1 Application Requirements</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When submitting a rental application through our platform, you agree to provide complete, accurate, and truthful information, including but not limited to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Personal identification information and government-issued identification documents</li>
              <li>Current and previous residential addresses and landlord contact information</li>
              <li>Employment history, employer contact information, and income verification</li>
              <li>Financial information, including bank statements and proof of funds</li>
              <li>References from previous landlords, employers, and personal contacts</li>
              <li>Any other information reasonably requested as part of the application process</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">3.2 Application Fee</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              A non-refundable application fee is required to process your rental application. THE APPLICATION FEE IS NON-REFUNDABLE UNDER ALL CIRCUMSTANCES, INCLUDING BUT NOT LIMITED TO APPLICATION DENIAL, WITHDRAWAL OF APPLICATION, CHANGE OF MIND, OR FAILURE TO MEET ELIGIBILITY REQUIREMENTS. By submitting payment, you acknowledge and agree that the application fee covers administrative costs associated with processing your application, including but not limited to background checks, credit checks, employment verification, reference checks, and document review.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The current application fee amount will be clearly displayed before you submit your payment. We reserve the right to modify the application fee amount at any time without prior notice.
            </p>

            <h3 className="text-xl font-medium mb-3">3.3 Background Checks and Screening</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              By submitting a rental application, you expressly authorize Sterling Gate Properties and its designated third-party service providers to conduct comprehensive background screening, which may include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Consumer credit reports and credit history from one or more consumer reporting agencies</li>
              <li>Criminal background checks, including national, state, and local records</li>
              <li>Sex offender registry searches</li>
              <li>Eviction history and landlord-tenant court records</li>
              <li>Employment verification and income confirmation</li>
              <li>Identity verification and fraud detection screening</li>
              <li>Terrorist watch list and sanctions screenings</li>
              <li>Reference checks with previous landlords and personal references</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              You understand and acknowledge that the results of these background checks may affect the outcome of your application. We will comply with all applicable laws regarding the use of consumer reports in making rental decisions, including providing required disclosures and adverse action notices.
            </p>

            <h3 className="text-xl font-medium mb-3">3.4 No Guarantee of Approval</h3>
            <p className="text-muted-foreground leading-relaxed">
              SUBMISSION OF A RENTAL APPLICATION AND PAYMENT OF THE APPLICATION FEE DOES NOT GUARANTEE APPROVAL. We reserve the right to approve or deny any application in our sole discretion based on our screening criteria and applicable law. Factors that may result in application denial include, but are not limited to: insufficient income, poor credit history, negative rental history, criminal background concerns, incomplete or inaccurate application information, or failure to meet other eligibility criteria.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">4. Document Submission and Verification</h2>
            
            <h3 className="text-xl font-medium mb-3">4.1 Required Documents</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              As part of the application process, you may be required to submit copies of sensitive documents, including government-issued identification (driver's license, state ID, passport), Social Security cards, and other verification materials. By uploading these documents:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>You represent and warrant that the documents are authentic, unaltered, and belong to you</li>
              <li>You authorize us to use these documents for identity verification, background screening, and lease processing purposes</li>
              <li>You acknowledge that submitting false, fraudulent, or altered documents is a criminal offense and grounds for immediate application denial and potential legal action</li>
              <li>You consent to the storage, processing, and retention of these documents in accordance with our Privacy Policy</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">4.2 Document Security</h3>
            <p className="text-muted-foreground leading-relaxed">
              We employ industry-standard security measures to protect your submitted documents, including 256-bit AES encryption, secure storage, and access controls. However, you acknowledge that no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security. You agree to hold us harmless for any unauthorized access to or disclosure of your documents that occurs despite our reasonable security efforts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">5. Payment Terms</h2>
            
            <h3 className="text-xl font-medium mb-3">5.1 Payment Processing</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              All payments through our platform are processed by third-party payment processors, including Stripe. By making payments through our Services, you agree to the terms and conditions of the applicable payment processor. We are not responsible for any errors, failures, or issues arising from the payment processor's services.
            </p>

            <h3 className="text-xl font-medium mb-3">5.2 Application Fees</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Application fees are due at the time of application submission and are NON-REFUNDABLE. This includes situations where:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Your application is denied for any reason</li>
              <li>You withdraw your application before or after processing begins</li>
              <li>The property becomes unavailable</li>
              <li>You change your mind or decide not to proceed</li>
              <li>You fail to provide required documentation</li>
              <li>The application is incomplete or contains errors</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">5.3 Rent and Other Payments</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If your application is approved and you enter into a lease agreement, you agree to pay rent and all other charges in accordance with the terms of your lease agreement. Late payments may be subject to late fees as specified in your lease agreement and applicable law.
            </p>

            <h3 className="text-xl font-medium mb-3">5.4 Security Deposits</h3>
            <p className="text-muted-foreground leading-relaxed">
              Security deposits, where required, will be collected, held, and returned in accordance with applicable state and local laws and the terms of your lease agreement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">6. User Responsibilities and Prohibited Conduct</h2>
            
            <h3 className="text-xl font-medium mb-3">6.1 User Responsibilities</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree to use the Services only for lawful purposes and in accordance with these Terms. You are responsible for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Providing accurate and truthful information in all submissions</li>
              <li>Keeping your account credentials secure and confidential</li>
              <li>Complying with all applicable laws and regulations</li>
              <li>Respecting the rights of other users and third parties</li>
              <li>Maintaining appropriate insurance as required by your lease</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">6.2 Prohibited Conduct</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree NOT to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Provide false, misleading, or fraudulent information in any application or communication</li>
              <li>Submit falsified, altered, or counterfeit documents</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Attempt to gain unauthorized access to any part of the Services or any systems or networks connected to the Services</li>
              <li>Use the Services for any illegal, harmful, or fraudulent purpose</li>
              <li>Interfere with or disrupt the Services or servers or networks connected to the Services</li>
              <li>Transmit any viruses, malware, or other harmful code</li>
              <li>Harvest or collect email addresses or other personal information of other users</li>
              <li>Use any automated systems or means to access the Services without our express written permission</li>
              <li>Circumvent, disable, or otherwise interfere with security-related features of the Services</li>
              <li>Violate any applicable local, state, national, or international law or regulation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">7. Intellectual Property Rights</h2>
            
            <h3 className="text-xl font-medium mb-3">7.1 Company Ownership</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The Services and all content, features, and functionality thereof, including but not limited to text, graphics, logos, icons, images, audio clips, video clips, data compilations, software, and the design, selection, and arrangement thereof, are the exclusive property of Sterling Gate Properties, its licensors, or other content suppliers and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
            </p>

            <h3 className="text-xl font-medium mb-3">7.2 Limited License</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Services solely for your personal, non-commercial purposes related to seeking or managing commercial property leases.
            </p>

            <h3 className="text-xl font-medium mb-3">7.3 Restrictions</h3>
            <p className="text-muted-foreground leading-relaxed">
              You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any of the material on our Services, except as incidental to your normal use of the Services or as expressly permitted in writing by us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">8. Disclaimers and Limitation of Liability</h2>
            
            <h3 className="text-xl font-medium mb-3">8.1 Disclaimer of Warranties</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT ANY WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              WE DO NOT WARRANT THAT (A) THE SERVICES WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; (B) THE RESULTS OBTAINED FROM USE OF THE SERVICES WILL BE ACCURATE OR RELIABLE; (C) THE QUALITY OF ANY PRODUCTS, SERVICES, INFORMATION, OR OTHER MATERIAL OBTAINED BY YOU THROUGH THE SERVICES WILL MEET YOUR EXPECTATIONS; OR (D) ANY ERRORS IN THE SERVICES WILL BE CORRECTED.
            </p>

            <h3 className="text-xl font-medium mb-3">8.2 Limitation of Liability</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL STERLING GATE PROPERTIES, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES, REGARDLESS OF WHETHER WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL DAMAGES, LOSSES, AND CAUSES OF ACTION EXCEED THE AMOUNT PAID BY YOU, IF ANY, FOR ACCESSING OR USING THE SERVICES DURING THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF CERTAIN WARRANTIES OR LIABILITY, SO THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU. IN SUCH CASES, OUR LIABILITY WILL BE LIMITED TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">9. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to defend, indemnify, and hold harmless Sterling Gate Properties, its affiliates, officers, directors, employees, agents, licensors, and suppliers from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt, and expenses (including but not limited to attorney's fees) arising from: (a) your use of and access to the Services; (b) your violation of any provision of these Terms; (c) your violation of any third-party right, including without limitation any intellectual property, privacy, or proprietary right; (d) any claim that your use of the Services caused damage to a third party; (e) any content you submit or transmit through the Services; or (f) your violation of any applicable law or regulation. This defense and indemnification obligation will survive these Terms and your use of the Services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">10. Dispute Resolution and Arbitration</h2>
            
            <h3 className="text-xl font-medium mb-3">10.1 Informal Resolution</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Before initiating any formal dispute resolution proceedings, you agree to first contact us and attempt to resolve any dispute informally. Most disputes can be resolved through informal negotiation.
            </p>

            <h3 className="text-xl font-medium mb-3">10.2 Binding Arbitration</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              IF WE CANNOT RESOLVE A DISPUTE INFORMALLY, ANY DISPUTE, CLAIM, OR CONTROVERSY ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICES, INCLUDING THE DETERMINATION OF THE SCOPE OR APPLICABILITY OF THIS AGREEMENT TO ARBITRATE, SHALL BE DETERMINED BY BINDING ARBITRATION ADMINISTERED BY THE AMERICAN ARBITRATION ASSOCIATION ("AAA") IN ACCORDANCE WITH ITS COMMERCIAL ARBITRATION RULES.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The arbitration shall be conducted in the English language and shall take place in [City, State]. The arbitrator's award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.
            </p>

            <h3 className="text-xl font-medium mb-3">10.3 Class Action Waiver</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              YOU AGREE THAT ANY CLAIMS MUST BE BROUGHT IN YOUR INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING. You expressly waive any right to participate in a class action lawsuit or class-wide arbitration against Sterling Gate Properties.
            </p>

            <h3 className="text-xl font-medium mb-3">10.4 Exceptions</h3>
            <p className="text-muted-foreground leading-relaxed">
              Notwithstanding the foregoing, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to protect its intellectual property rights or confidential information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">11. Governing Law and Jurisdiction</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms and any dispute arising out of or related to these Terms or the Services shall be governed by and construed in accordance with the laws of the State of [State], without regard to its conflict of law provisions. Subject to the arbitration provisions above, you consent to the exclusive jurisdiction and venue of the state and federal courts located in [County, State] for any disputes not subject to arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">12. Termination</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may terminate or suspend your access to the Services immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms. Upon termination, your right to use the Services will immediately cease.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              All provisions of these Terms which by their nature should survive termination shall survive termination, including, without limitation, ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">13. Force Majeure</h2>
            <p className="text-muted-foreground leading-relaxed">
              We shall not be liable for any failure or delay in performing our obligations under these Terms due to circumstances beyond our reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, accidents, strikes, or shortages of transportation, facilities, fuel, energy, labor, or materials.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">14. Severability</h2>
            <p className="text-muted-foreground leading-relaxed">
              If any provision of these Terms is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, such invalidity, illegality, or unenforceability shall not affect any other provision of these Terms. The remaining provisions shall continue in full force and effect, and the invalid, illegal, or unenforceable provision shall be modified to the minimum extent necessary to make it valid, legal, and enforceable while preserving the intent of the parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">15. Waiver</h2>
            <p className="text-muted-foreground leading-relaxed">
              No waiver by Sterling Gate Properties of any term or condition set forth in these Terms shall be deemed a further or continuing waiver of such term or condition or a waiver of any other term or condition, and any failure of Sterling Gate Properties to assert a right or provision under these Terms shall not constitute a waiver of such right or provision.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">16. Entire Agreement</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms, together with our Privacy Policy and any other legal notices or agreements published by us on the Services, constitute the entire agreement between you and Sterling Gate Properties concerning the Services and supersede all prior and contemporaneous understandings, agreements, representations, and warranties, both written and oral, regarding the Services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">17. Assignment</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may not assign or transfer these Terms, by operation of law or otherwise, without our prior written consent. Any attempt by you to assign or transfer these Terms without such consent will be null and void. We may freely assign or transfer these Terms without restriction. Subject to the foregoing, these Terms will bind and inure to the benefit of the parties, their successors, and permitted assigns.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">18. Notices</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may provide notices to you via email, regular mail, or postings on the Services. You agree that all notices, disclosures, and other communications that we provide to you electronically satisfy any legal requirement that such communications be in writing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">19. Electronic Signatures and Communications</h2>
            <p className="text-muted-foreground leading-relaxed">
              By using our Services, you consent to receive electronic communications from us, including emails, texts, mobile push notices, and notices posted on the Services. You agree that any notices, agreements, disclosures, or other communications that we send to you electronically will satisfy any legal communication requirements, including that such communications be in writing.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You acknowledge and agree that electronic signatures on documents executed through our platform are legally binding and enforceable to the same extent as handwritten signatures under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and applicable state laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">20. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <div className="bg-secondary/50 rounded-lg p-6 text-muted-foreground">
              <p className="font-medium text-foreground mb-2">Sterling Gate Properties</p>
              <p>Legal Department</p>
              <p>Email: legal@sterlinggate.com</p>
              <p>Phone: (555) 123-4567</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-serif mb-4">21. Acknowledgment</h2>
            <p className="text-muted-foreground leading-relaxed">
              BY USING THE SERVICES, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE, UNDERSTAND THEM, AND AGREE TO BE BOUND BY THEIR TERMS AND CONDITIONS. YOU FURTHER AGREE THAT THESE TERMS OF SERVICE, TOGETHER WITH OUR PRIVACY POLICY, CONSTITUTE THE COMPLETE AND EXCLUSIVE STATEMENT OF THE AGREEMENT BETWEEN YOU AND STERLING GATE PROPERTIES, WHICH SUPERSEDES ANY PROPOSAL OR PRIOR AGREEMENT, ORAL OR WRITTEN, AND ANY OTHER COMMUNICATIONS BETWEEN YOU AND STERLING GATE PROPERTIES RELATING TO THE SUBJECT MATTER OF THESE TERMS.
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