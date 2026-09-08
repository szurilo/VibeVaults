/**
 * Main Responsibility: Public terms of service. Also carries the Ekertv. 4. §
 * service provider disclosure and the Article 28 processor terms that the
 * privacy policy points at when it calls this document half of the data
 * processing agreement.
 *
 * Sensitive Dependencies:
 * - `OPERATOR` in `@/lib/legal-entity` is shared with the privacy policy. Both
 *   pages must name the same entity with the same registration numbers.
 * - Section 8 is referenced by /privacy-policy section 4. If the processor
 *   terms move or are removed, that reference breaks and the DPA claim in the
 *   privacy policy stops being true.
 * - Section 9 states the trial length and that no card is required. That mirrors
 *   the trial clock in `20260417000000_trial_starts_on_workspace_creation.sql`
 *   (14 days, starting at first owned workspace) and the comparison pages in
 *   `@/lib/compare-data`.
 */
import Link from "next/link";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { OPERATOR } from "@/lib/legal-entity";

const LAST_UPDATED = "September 1, 2026";

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-white">
            <SiteHeader />

            <main className="max-w-3xl mx-auto px-8 py-12">
                <h1 className="text-4xl font-extrabold mb-4 text-gray-900">Terms of Service</h1>
                <p className="text-gray-500 mb-8">
                    <strong>Last updated:</strong> {LAST_UPDATED}
                </p>

                <div className="prose prose-gray max-w-none">
                    <p className="mb-6">
                        These Terms of Service (&#8220;Terms&#8221;) govern your use of VibeVaults (the &#8220;Service&#8221;), operated by {OPERATOR.name} {OPERATOR.shortLegalForm} (&#8220;we&#8221;, &#8220;us&#8221;, &#8220;our&#8221;).
                    </p>
                    <p className="mb-6">
                        By accessing or using the Service, you agree to these Terms.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">1. Who We Are</h2>
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

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">2. The Service</h2>
                    <p className="mb-4">
                        We provide a hosted feedback widget and an administrative dashboard that allows customers to collect and manage feedback submitted by end users.
                    </p>
                    <p className="mb-6">
                        The Service is provided on an &#8220;as is&#8221; and &#8220;as available&#8221; basis.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">3. Eligibility and Business Use</h2>
                    <p className="mb-4">
                        The Service is offered to businesses and professionals for use in their trade, business, or profession. It is not directed at consumers, and you must be at least 18 years old and able to enter into a binding contract to use it.
                    </p>
                    <p className="mb-6">
                        If, despite the above, you qualify as a consumer under applicable law, you have a statutory right to withdraw from the contract within 14 days without giving a reason. By starting to use a paid subscription during that period you expressly request that we begin performance immediately, and you acknowledge that you lose the right of withdrawal once the Service has been fully performed. Nothing in these Terms limits mandatory consumer rights you may have.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">4. Accounts</h2>
                    <p className="mb-4">To use the administrative dashboard, you must create an account.</p>
                    <p className="mb-4">You are responsible for:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>maintaining the confidentiality of your login credentials</li>
                        <li>all activity that occurs under your account</li>
                        <li>the people you invite into your workspaces, and what they do there</li>
                    </ul>
                    <p className="mb-6">
                        You must provide accurate and up-to-date information.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">5. Acceptable Use</h2>
                    <p className="mb-4">You agree not to use the Service to:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>submit or collect illegal, harmful, or abusive content</li>
                        <li>send spam or automated submissions</li>
                        <li>violate applicable laws or regulations</li>
                        <li>interfere with or disrupt the Service</li>
                        <li>embed the widget on a website you do not own or are not authorised to modify</li>
                        <li>attempt to circumvent plan limits, access controls, or rate limits</li>
                        <li>resell or provide the Service to third parties as a standalone product</li>
                    </ul>
                    <p className="mb-6">
                        We reserve the right to suspend or terminate accounts that violate these rules.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">6. User Content and Feedback</h2>
                    <p className="mb-4">Feedback submitted through the widget is provided by end users voluntarily.</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>You are responsible for the content collected through your widget.</li>
                        <li>We do not review feedback content by default.</li>
                        <li>We reserve the right to remove content that violates these Terms or applicable laws.</li>
                    </ul>
                    <p className="mb-6">
                        You retain ownership of your content. You grant us a limited license to store and process it solely for the purpose of providing the Service.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">7. Your Responsibilities as Data Controller</h2>
                    <p className="mb-4">
                        Where the widget collects personal data from your end users, you are the data controller and we are your processor. You are responsible for:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>having a lawful basis for the collection and processing</li>
                        <li>informing your end users about what is collected, including through your own privacy notice</li>
                        <li>answering your end users&apos; data protection requests, with our assistance</li>
                        <li>not using the Service to collect special categories of personal data, payment card numbers, or credentials</li>
                    </ul>
                    <p className="mb-6">
                        Our <Link href="/docs/widget-data" className="underline">widget data reference</Link> sets out exactly what the widget captures, so you can describe it accurately to your end users.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">8. Data Protection and Processor Terms</h2>
                    <p className="mb-4">
                        This section, together with our <Link href="/privacy-policy" className="underline">Privacy Policy</Link>, forms the data processing agreement between us under Article 28 of the GDPR. We undertake to:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>process personal data only on your documented instructions, which these Terms and your use of the Service constitute, unless required otherwise by law</li>
                        <li>ensure that persons authorised to process the data are bound by confidentiality</li>
                        <li>implement appropriate technical and organisational security measures</li>
                        <li>engage only the sub-processors listed in our Privacy Policy, under equivalent obligations, and give you notice before a new sub-processor starts processing your data so you have an opportunity to object</li>
                        <li>assist you, taking into account the nature of the processing, in responding to data subject requests and in meeting your security, breach notification, and impact assessment obligations</li>
                        <li>notify you without undue delay after becoming aware of a personal data breach affecting your data</li>
                        <li>delete or return your personal data at the end of the contract, except where storage is required by law</li>
                        <li>make available the information reasonably necessary to demonstrate compliance with this section</li>
                    </ul>
                    <p className="mb-6">
                        The subject matter, duration, nature, and purpose of the processing, the types of personal data, and the categories of data subjects are described in our Privacy Policy.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">9. Trial, Payments and Subscriptions</h2>
                    <p className="mb-4">
                        New accounts start with a <strong>14-day free trial</strong>, which begins when you create your first workspace. No payment details are required for the trial. There is no free plan: when the trial ends, the widget and paid features stop working unless you subscribe.
                    </p>
                    <p className="mb-4">Paid subscriptions are processed by <strong>Stripe</strong>, a third-party payment provider.</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Prices are listed on our website and are stated exclusive of any applicable taxes unless indicated otherwise.</li>
                        <li>Subscriptions renew automatically on a recurring basis until cancelled.</li>
                        <li>We may change prices. Changes take effect at your next renewal, and we will give you at least 30 days&apos; notice by email so you can cancel before the change applies.</li>
                        <li>Unless otherwise stated, or required by mandatory law, fees already paid are non-refundable.</li>
                        <li>If a payment fails, we may suspend access to paid features until the balance is settled.</li>
                    </ul>
                    <p className="mb-6">
                        You may cancel your subscription at any time from the billing portal. Upon cancellation, access to paid features continues until the end of the billing period you have already paid for, and is then limited or disabled.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">10. Availability and Support</h2>
                    <p className="mb-4">
                        We strive to keep the Service available, but we do not guarantee uninterrupted or error-free operation.
                    </p>
                    <p className="mb-4">
                        We do not provide a guaranteed uptime or service-level agreement (SLA) for the Service.
                    </p>
                    <p className="mb-6">
                        Support is provided by email at {OPERATOR.email}. We are not liable for delays or failures caused by events beyond our reasonable control, including infrastructure provider outages, network failures, and acts of public authorities.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">11. Third-Party Services</h2>
                    <p className="mb-4">
                        The Service relies on third-party infrastructure and services, including but not limited to:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Supabase</strong> (authentication, database, and file storage)</li>
                        <li><strong>Vercel</strong> (hosting and deployment)</li>
                        <li><strong>Stripe</strong> (payment processing)</li>
                        <li><strong>Resend</strong> (transactional email delivery)</li>
                        <li><strong>Cloudflare Turnstile</strong> (anti-bot verification)</li>
                        <li><strong>PostHog</strong> (product analytics and error tracking)</li>
                        <li><strong>GitHub</strong> (source control, automation, and private database backup storage)</li>
                    </ul>
                    <p className="mb-6">
                        We are not responsible for outages or failures caused by these providers. Where they process personal data on our behalf, they are listed as sub-processors in our <Link href="/privacy-policy" className="underline">Privacy Policy</Link>.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">12. Limitation of Liability</h2>
                    <p className="mb-4">To the maximum extent permitted by law:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>We shall not be liable for indirect, incidental, or consequential damages, including lost profits, lost revenue, or loss of data.</li>
                        <li>Our total liability related to the Service shall not exceed the amount you paid us in the 12 months preceding the event giving rise to the claim.</li>
                    </ul>
                    <p className="mb-4">
                        <strong>Nothing in these Terms excludes or limits our liability</strong> for death or personal injury, for damage caused intentionally or by gross negligence, for fraud, or for any other liability that cannot be excluded or limited under applicable law.
                    </p>
                    <p className="mb-6">
                        You are responsible for the content you collect through the Service, and you will hold us harmless against third-party claims arising from your use of the Service in breach of these Terms or of applicable data protection law.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">13. Termination and Data Retrieval</h2>
                    <p className="mb-4">You may stop using the Service at any time, and delete your account from the dashboard.</p>
                    <p className="mb-4">We may suspend or terminate your access if:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>you violate these Terms</li>
                        <li>your use creates legal or technical risk</li>
                        <li>your subscription remains unpaid after we have given you notice</li>
                    </ul>
                    <p className="mb-6">
                        Except where we terminate for a serious breach or are required to act immediately, we will give you 30 days after termination to export your feedback data before it is deleted. Deleting your account from the dashboard deletes your data immediately, subject to the retention periods in our Privacy Policy.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">14. Changes to These Terms</h2>
                    <p className="mb-4">We may update these Terms from time to time.</p>
                    <p className="mb-6">
                        Updated versions will be posted on our website with a revised &#8220;Last updated&#8221; date. Where a change materially affects your rights or obligations, we will notify account holders by email at least 30 days before it takes effect. Continued use of the Service after that date means you accept the updated Terms; if you do not, you may cancel before they take effect.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">15. Governing Law and Disputes</h2>
                    <p className="mb-4">
                        These Terms are governed by the laws of <strong>Hungary</strong>, without regard to conflict of law principles and excluding the UN Convention on Contracts for the International Sale of Goods.
                    </p>
                    <p className="mb-6">
                        The courts of Hungary have jurisdiction over any dispute arising out of or in connection with these Terms. If you are a consumer, this does not deprive you of the protection of the mandatory law of the country where you live, or of your right to bring proceedings there. We ask that you contact us first at {OPERATOR.email} so we can try to resolve the matter directly.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">16. General</h2>
                    <ul className="list-disc pl-6 mb-6 space-y-2">
                        <li><strong>Severability.</strong> If any provision of these Terms is found unenforceable, the rest remains in force and the unenforceable provision is replaced by one that comes closest to its intended effect.</li>
                        <li><strong>No waiver.</strong> Not enforcing a provision is not a waiver of the right to enforce it later.</li>
                        <li><strong>Assignment.</strong> You may not assign these Terms without our written consent. We may assign them in connection with a transfer of the business, on notice to you.</li>
                        <li><strong>Entire agreement.</strong> These Terms and the Privacy Policy are the entire agreement between us regarding the Service and replace any earlier understandings.</li>
                    </ul>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">17. Contact</h2>
                    <p className="mb-4">
                        If you have questions about these Terms, contact us at:
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
