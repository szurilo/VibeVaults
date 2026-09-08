/**
 * Main Responsibility: Public privacy policy. Doubles as the GDPR Article 13/14
 * information notice, so it has to name the controller in a legally
 * identifiable way and list every category of data the product actually
 * touches.
 *
 * Sensitive Dependencies:
 * - `OPERATOR` in `@/lib/legal-entity` is the controller identity under GDPR
 *   Art. 13(1)(a), shared with the terms of service. For a
 *   Hungarian sole trader ("egyéni vállalkozó") a bare personal name is not
 *   enough: the registration number, tax number, and registered seat are what
 *   make the controller identifiable. Blank values are omitted from the render,
 *   so an unfilled field silently degrades rather than shipping "TODO" to
 *   production, but it is still a compliance gap until filled.
 * - Section 3.2 mirrors what `public/widget.js` (`getMetadata`) actually
 *   captures and what `/docs/widget-data` tells customers. If the widget starts
 *   or stops collecting something, all three have to move together.
 * - Section 7 is the sub-processor list. Adding a vendor that touches personal
 *   data means adding it here.
 */
import Link from "next/link";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { OPERATOR } from "@/lib/legal-entity";


const LAST_UPDATED = "September 1, 2026";

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-white">
            <SiteHeader />

            <main className="max-w-3xl mx-auto px-8 py-12">
                <h1 className="text-4xl font-extrabold mb-4 text-gray-900">Privacy Policy</h1>
                <p className="text-gray-500 mb-8">
                    <strong>Last updated:</strong> {LAST_UPDATED}
                </p>

                <div className="prose prose-gray max-w-none">
                    <p className="mb-6">
                        This Privacy Policy describes how VibeVaults (&#8220;we&#8221;, &#8220;us&#8221;, &#8220;our&#8221;) collects, uses, and protects personal data in connection with the use of our service, as described in our Terms of Service.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">1. Who We Are</h2>
                    <p className="mb-4">
                        VibeVaults is a hosted feedback widget and administrative dashboard service. The data controller for the personal data described in this policy is:
                    </p>
                    <p className="mb-4">
                        <strong>Service name:</strong> VibeVaults<br />
                        <strong>Operator:</strong> {OPERATOR.name}<br />
                        <strong>Legal form:</strong> {OPERATOR.legalForm}<br />
                        {OPERATOR.registrationNumber && (
                            <>
                                <strong>Registration number:</strong> {OPERATOR.registrationNumber}<br />
                            </>
                        )}
                        {OPERATOR.taxNumber && (
                            <>
                                <strong>Tax number:</strong> {OPERATOR.taxNumber}<br />
                            </>
                        )}
                        {OPERATOR.address && (
                            <>
                                <strong>Registered seat:</strong> {OPERATOR.address}<br />
                            </>
                        )}
                        <strong>Contact email:</strong> {OPERATOR.email}<br />
                        <strong>Location:</strong> {OPERATOR.country}
                    </p>
                    <p className="mb-6">
                        We have not appointed a Data Protection Officer. As a sole trader whose core activity is not large-scale monitoring or large-scale processing of special categories of data, we are not required to appoint one under GDPR Article 37. Data protection questions go to the contact address above.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">2. Scope of This Policy</h2>
                    <p className="mb-4">This Privacy Policy applies to:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>visitors of our website</li>
                        <li>customers using the administrative dashboard</li>
                        <li>end users submitting feedback through embedded widgets</li>
                    </ul>
                    <p className="mb-6">
                        Use of the Service is also governed by our <strong>Terms of Service</strong>.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">3. What Data We Collect</h2>

                    <h3 className="text-xl font-bold mb-3 text-gray-800">3.1 Admin Users (Customers)</h3>
                    <p className="mb-4">We collect:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Email address</li>
                        <li>Authentication data (handled via Supabase, stored securely; includes Google OAuth profile data such as name and avatar if you sign in with Google)</li>
                        <li>Workspace and project details you enter, such as names, website addresses, logos, and the email addresses of people you invite</li>
                        <li>Content you create in the dashboard, including feedback entries, replies, and uploaded attachments</li>
                        <li>Subscription and billing status (handled by Stripe)</li>
                        <li>Correspondence you send us by email</li>
                    </ul>
                    <p className="mb-6">
                        We do <strong>not</strong> store full payment card details.
                    </p>

                    <h3 className="text-xl font-bold mb-3 text-gray-800">3.2 End Users (Feedback Widget)</h3>
                    <p className="mb-4">
                        The widget is invite-only or opened through a review link. It shows nothing to an anonymous visitor. When feedback is submitted through a widget, the following is collected and shown to the customer who owns the widget:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>The feedback content submitted voluntarily, and any replies in the resulting conversation</li>
                        <li>Email address, and for review links a self-declared name, used to attribute the feedback and to send replies</li>
                        <li>Any files or screenshots the reporter chooses to attach</li>
                        <li>The address of the page the feedback was written on, and the position of the pin on that page together with a CSS selector for the element it was anchored to</li>
                        <li>Browser context: user agent string, screen and viewport size, and browser language</li>
                        <li>The last 50 browser console messages produced by the customer&apos;s own site while the reporter was on the page</li>
                        <li>Up to 15 failed network requests from the customer&apos;s own site, recorded as method, address, and outcome</li>
                        <li>Technical metadata such as IP address (for rate limiting and abuse prevention)</li>
                    </ul>
                    <p className="mb-4">
                        <strong>Query strings are removed before a page address is recorded.</strong> Only the origin and path are stored, because host site query strings routinely carry reset tokens, access tokens, and email addresses. Email-shaped path segments are replaced with a redaction marker. This stripping happens in the browser, before the entry is created, so the discarded part never reaches us. The full detail is published at{" "}
                        <Link href="/docs/widget-data" className="underline">docs/widget-data</Link>.
                    </p>
                    <p className="mb-4">
                        We also receive two operational signals from the widget that are not shown to customers and are used only to keep the widget working: crash reports raised by the widget&apos;s own code, and screenshot capture diagnostics (browser, graphics renderer, device pixel ratio, viewport, duration) used to measure a known browser rendering bug.
                    </p>
                    <p className="mb-6">
                        We do not require end users to create accounts, and the widget does not track end users across sites.
                    </p>

                    <h3 className="text-xl font-bold mb-3 text-gray-800">3.3 Website Visitors</h3>
                    <p className="mb-6">
                        On our own website we collect usage data through analytics only after you consent. See section 9.
                    </p>

                    <h3 className="text-xl font-bold mb-3 text-gray-800">3.4 Prospective Customers (Outreach)</h3>
                    <p className="mb-4">
                        We contact businesses that we think would benefit from VibeVaults, mainly design and web agencies. If you received an email from us and had no prior contact with us, this section is about you.
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>What we hold:</strong> your name, job title, business email address, employer, LinkedIn profile, and notes taken from your company&apos;s public website</li>
                        <li><strong>Where we got it:</strong> your company&apos;s website and public LinkedIn profile, and Apollo, a business contact database. We did not get it from you</li>
                        <li><strong>Why:</strong> to introduce a product relevant to your professional role. Legal basis is our legitimate interest in direct business-to-business marketing, Art. 6(1)(f)</li>
                        <li><strong>Business contact data only.</strong> We do not collect personal addresses, personal phone numbers, or anything about your private life</li>
                    </ul>
                    <p className="mb-6">
                        <strong>You can object at any time and we will stop.</strong> Reply to any message from us, or write to {OPERATOR.email}. We delete your details on request, except for the minimum needed to make sure we do not contact you again. We also delete contacts who never engaged after a reasonable period. You have the same rights over this data as anyone else in section 13, including the right to complain to a supervisory authority.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">4. Data Controller and Data Processor Roles</h2>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Our <strong>customers</strong> act as <strong>data controllers</strong> for feedback collected through widgets embedded on their sites.</li>
                        <li><strong>VibeVaults</strong> acts as a <strong>data processor</strong> for that feedback data, processing it solely on documented instructions from the customer.</li>
                        <li>For customer account data, billing data, and our own website analytics, <strong>VibeVaults is the data controller</strong>.</li>
                    </ul>
                    <p className="mb-4">
                        Customers are responsible for informing their end users about data collection and usage, and for having a lawful basis for it.
                    </p>
                    <p className="mb-6">
                        The processor terms in our <Link href="/terms-of-service" className="underline">Terms of Service</Link>, together with this policy and the sub-processor list in section 7, form the data processing agreement between us and our customers. We engage the sub-processors listed in section 7 and remain responsible for their performance. We will give customers notice of a new sub-processor before it starts processing their data, so they have an opportunity to object.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">5. How We Use the Data</h2>
                    <p className="mb-4">We use personal data only to:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Provide and operate the Service</li>
                        <li>Authenticate admin users</li>
                        <li>Store, display, and manage feedback</li>
                        <li>Prevent abuse, spam, and misuse</li>
                        <li>Process subscriptions and payments</li>
                        <li>Communicate service-related information</li>
                        <li>Diagnose faults and improve the Service</li>
                    </ul>
                    <p className="mb-6">
                        We do not use personal data for advertising purposes, and we do not sell personal data.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">6. Legal Basis for Processing (GDPR)</h2>
                    <p className="mb-4">For users in the European Union, we process personal data on these bases:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Contractual necessity</strong> (Art. 6(1)(b)): creating and running your account, delivering the Service, and sending service related messages.</li>
                        <li><strong>Legitimate interest</strong> (Art. 6(1)(f)): keeping the Service secure, preventing abuse and spam, and diagnosing faults. We balance this against your interests and use the least data that achieves the purpose.</li>
                        <li><strong>Legal obligation</strong> (Art. 6(1)(c)): retaining accounting and invoicing records, and responding to lawful requests.</li>
                        <li><strong>Consent</strong> (Art. 6(1)(a)): analytics and session replay on our own website, and any optional marketing email. You may withdraw consent at any time, which does not affect the lawfulness of processing carried out before withdrawal. Analytics consent can be withdrawn through the &ldquo;Cookie preferences&rdquo; link in the footer.</li>
                    </ul>
                    <p className="mb-6">
                        Where we act as a processor for feedback submitted through a customer&apos;s widget, the legal basis for that processing is determined by the customer, not by us.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">7. Third-Party Services (Sub-processors)</h2>
                    <p className="mb-4">We rely on the following service providers, each under a data processing agreement:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Supabase</strong> &ndash; database, authentication, and file storage</li>
                        <li><strong>Vercel</strong> &ndash; hosting and deployment infrastructure</li>
                        <li><strong>Stripe</strong> &ndash; payment processing and subscription billing</li>
                        <li><strong>Resend</strong> &ndash; transactional email delivery (notifications, digests)</li>
                        <li><strong>Cloudflare Turnstile</strong> &ndash; anti-bot verification during authentication</li>
                        <li><strong>PostHog</strong> &ndash; product analytics, session replays, and error tracking, on PostHog&apos;s EU hosting</li>
                        <li><strong>GitHub</strong> &ndash; source control and automation, and the private storage location for our encrypted nightly database backups</li>
                    </ul>
                    <p className="mb-6">
                        These providers process data only as necessary to deliver their services, on our instructions, and under their own privacy policies. We do not authorise them to use the data for their own purposes.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">8. International Data Transfers</h2>
                    <p className="mb-4">
                        Some of the providers listed above are established in the United States and may process personal data outside the European Economic Area.
                    </p>
                    <p className="mb-6">
                        Where that happens, the transfer is covered by an appropriate safeguard under Chapter V of the GDPR: the European Commission&apos;s Standard Contractual Clauses, and, where the provider is certified, the EU&ndash;U.S. Data Privacy Framework. You can request a copy of the relevant safeguards by writing to the contact address in section 18.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">9. Cookies and Analytics</h2>
                    <p className="mb-4">We use cookies and similar technologies for:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Essential cookies</strong> &ndash; authentication sessions and workspace/project preferences. These are required for the Service to function and do not require consent.</li>
                        <li><strong>Analytics (consent-based)</strong> &ndash; PostHog (EU-hosted) collects usage data, including page views, session replays, and error tracking, to help us improve the Service. These are loaded <strong>only after you accept</strong> via the cookie banner. Form inputs are masked by default in session replays.</li>
                        <li><strong>Anti-bot verification</strong> &ndash; Cloudflare Turnstile may set cookies to verify human users during authentication. This is essential to prevent abuse.</li>
                    </ul>
                    <p className="mb-4">
                        Visitors from the EU, EEA, UK, and Switzerland see a consent banner on first visit. You can change your choices at any time via the &ldquo;Cookie preferences&rdquo; link in the footer.
                    </p>
                    <p className="mb-4">
                        The embedded feedback widget does not set analytics or advertising cookies on our customers&apos; sites. It stores a single access token in the browser&apos;s local storage so an invited person stays signed in to the widget on that device.
                    </p>
                    <p className="mb-6">
                        We do not use cookies for advertising or third-party tracking.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">10. Data Storage and Retention</h2>
                    <p className="mb-4">
                        Data is stored on secure servers provided by our infrastructure partners. We keep personal data only as long as it is needed for the purpose it was collected for:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Account data</strong> is kept while the account exists, and deleted when you delete the account.</li>
                        <li><strong>Feedback and conversation data</strong> is kept until the customer deletes it or deletes the project it belongs to. Customers can delete it at any time from the dashboard.</li>
                        <li><strong>Accounting and invoicing records</strong> are kept for 8 years, as required by Hungarian accounting law. This retention overrides a deletion request for those specific records.</li>
                        <li><strong>IP addresses</strong> collected for rate limiting and abuse prevention are retained for up to 30 days, then purged or anonymized.</li>
                        <li><strong>Widget access tokens</strong> that are never used are deleted automatically 30 days after they are issued.</li>
                        <li><strong>Analytics data</strong> is retained for 1 year.</li>
                        <li><strong>Prospect contact data</strong> is deleted on objection, and contacts who never engaged are removed periodically. An opt-out record is kept indefinitely, because that is what stops us contacting you again.</li>
                        <li><strong>Support correspondence</strong> is kept for as long as the mailbox holds it, so that we can pick up an old thread if you write again.</li>
                    </ul>
                    <p className="mb-6">
                        When we act as a processor, we delete or return customer feedback data on the customer&apos;s instruction, and after the end of the contract, subject to the legal retention above.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">11. Data Security</h2>
                    <p className="mb-4">
                        We implement reasonable technical and organizational measures to protect personal data, including encryption in transit, row-level access control in the database, scoped access tokens for the widget, and restricted administrative access.
                    </p>
                    <p className="mb-6">
                        However, no system can be guaranteed to be 100% secure.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">12. Automated Decision-Making</h2>
                    <p className="mb-6">
                        We do not carry out automated decision-making that produces legal effects concerning you or similarly significantly affects you, and we do not profile users within the meaning of GDPR Article 22.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">13. Your Rights</h2>
                    <p className="mb-4">Under the GDPR you have the right to:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Access your personal data and receive a copy of it</li>
                        <li>Have inaccurate data corrected</li>
                        <li>Have your data deleted (&ldquo;right to be forgotten&rdquo;)</li>
                        <li>Restrict processing</li>
                        <li>Object to processing based on legitimate interest</li>
                        <li>Receive your data in a portable, machine-readable format</li>
                        <li>Withdraw consent at any time, where processing is based on consent</li>
                    </ul>
                    <p className="mb-4">
                        Requests can be made by contacting us at the address in section 18. We respond within one month, which may be extended by two further months for complex requests, in which case we will tell you within the first month.
                    </p>
                    <p className="mb-4">
                        If your data was submitted through a widget on someone else&apos;s website, that website&apos;s operator is the controller. We will forward your request to them and assist them in answering it.
                    </p>
                    <p className="mb-6">
                        <strong>Right to lodge a complaint.</strong> If you believe we have handled your personal data unlawfully, you may complain to a supervisory authority, in particular in the EU country where you live or work. Our lead supervisory authority is the Hungarian National Authority for Data Protection and Freedom of Information (Nemzeti Adatvédelmi és Információszabadság Hatóság, NAIH), <a href="https://naih.hu" className="underline" target="_blank" rel="noopener noreferrer">naih.hu</a>. You also have the right to an effective judicial remedy.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">14. Children</h2>
                    <p className="mb-6">
                        The Service is not intended for children. You must be at least 16 years old to create an account or submit feedback. If we learn that we have collected personal data from a child under 16 without parental consent, we will delete it.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">15. Data Breach Notification</h2>
                    <p className="mb-6">
                        In the event of a personal data breach likely to result in a risk to the rights and freedoms of affected individuals, we will notify the relevant supervisory authority within 72 hours of becoming aware of the breach, in accordance with GDPR Article 33. Where the breach is likely to result in a high risk, we will also notify affected users without undue delay. Where we act as a processor, we will notify the affected customer without undue delay after becoming aware of the breach.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">16. California Residents (CCPA / CPRA)</h2>
                    <p className="mb-4">
                        If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA) as amended by the CPRA:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Right to know what personal information we collect and how we use it</li>
                        <li>Right to delete your personal information</li>
                        <li>Right to correct inaccurate personal information</li>
                        <li>Right to non-discrimination for exercising your rights</li>
                    </ul>
                    <p className="mb-6">
                        <strong>We do not sell or share your personal information</strong> for cross-context behavioral advertising, and we do not use it for targeted advertising. To exercise your rights, contact us at the address below.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">17. Changes to This Policy</h2>
                    <p className="mb-4">We may update this Privacy Policy from time to time.</p>
                    <p className="mb-6">
                        Changes will be posted on this page with an updated &#8220;Last updated&#8221; date. Where a change materially affects how we process your personal data, we will notify account holders by email.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">18. Contact</h2>
                    <p className="mb-4">
                        If you have questions about this Privacy Policy or data protection matters, contact:
                    </p>
                    <p className="mb-6">
                        <strong>{OPERATOR.name}</strong> {OPERATOR.shortLegalForm}<br />
                        {OPERATOR.address && (
                            <>
                                {OPERATOR.address}<br />
                            </>
                        )}
                        <strong>Email:</strong> {OPERATOR.email}
                    </p>
                </div>
            </main>

            <SiteFooter />
        </div>
    );
}
