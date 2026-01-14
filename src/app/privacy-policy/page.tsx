
import Link from "next/link";

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-white">
            <header className="border-b border-gray-100">
                <div className="max-w-3xl mx-auto px-8 py-6">
                    <Link href="/" className="font-bold text-xl tracking-tight text-primary hover:opacity-90 transition-opacity">
                        VibeVaults
                    </Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-8 py-12">
                <h1 className="text-4xl font-extrabold mb-4 text-gray-900">Privacy Policy</h1>
                <p className="text-gray-500 mb-8">
                    <strong>Last updated:</strong> January 14, 2026
                </p>

                <div className="prose prose-gray max-w-none">
                    <p className="mb-6">
                        This Privacy Policy describes how VibeVaults (&#8220;we&#8221;, &#8220;us&#8221;, &#8220;our&#8221;) collects, uses, and protects personal data in connection with the use of our service, as described in our Terms of Service.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">1. Who We Are</h2>
                    <p className="mb-4">
                        <strong>Service name:</strong> VibeVaults<br />
                        <strong>Operator:</strong> József Tar<br />
                        <strong>Contact email:</strong> info@vibe-vaults.com<br />
                        <strong>Location:</strong> European Union (Hungary)
                    </p>
                    <p className="mb-6">
                        We operate a hosted feedback widget and administrative dashboard service.
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
                        <li>Authentication data (handled via Supabase, stored securely)</li>
                        <li>Subscription and billing status (handled by Stripe)</li>
                    </ul>
                    <p className="mb-6">
                        We do <strong>not</strong> store full payment card details.
                    </p>

                    <h3 className="text-xl font-bold mb-3 text-gray-800">3.2 End Users (Feedback Widget)</h3>
                    <p className="mb-4">When feedback is submitted via a widget, we may collect:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Feedback content submitted voluntarily</li>
                        <li>Technical metadata such as IP address and user agent (for security and abuse prevention)</li>
                    </ul>
                    <p className="mb-6">
                        We do not require end users to create accounts.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">4. Data Controller and Data Processor Roles</h2>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Our <strong>customers</strong> act as <strong>data controllers</strong> for feedback collected through widgets.</li>
                        <li><strong>VibeVaults</strong> acts as a <strong>data processor</strong>, processing feedback data solely on behalf of customers.</li>
                    </ul>
                    <p className="mb-6">
                        Customers are responsible for informing their end users about data collection and usage.
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
                    </ul>
                    <p className="mb-6">
                        We do not use personal data for advertising purposes.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">6. Legal Basis for Processing (GDPR)</h2>
                    <p className="mb-4">For users in the European Union, we process personal data based on:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Contractual necessity</strong> (providing the Service)</li>
                        <li><strong>Legitimate interest</strong> (security, abuse prevention)</li>
                        <li><strong>Legal obligation</strong> (billing and compliance)</li>
                    </ul>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">7. Third-Party Services</h2>
                    <p className="mb-4">We rely on the following third-party service providers:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Supabase</strong> – authentication and database services</li>
                        <li><strong>Vercel</strong> – hosting and deployment infrastructure</li>
                        <li><strong>Stripe</strong> – payment processing</li>
                    </ul>
                    <p className="mb-6">
                        These providers process data only as necessary to deliver their services and under their own privacy policies.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">8. Data Storage and Retention</h2>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Data is stored on secure servers provided by our infrastructure partners.</li>
                        <li>We retain data only as long as necessary to provide the Service or comply with legal obligations.</li>
                        <li>Customers may delete feedback data via the dashboard or request deletion.</li>
                    </ul>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">9. Data Security</h2>
                    <p className="mb-4">
                        We implement reasonable technical and organizational measures to protect personal data.
                    </p>
                    <p className="mb-6">
                        However, no system can be guaranteed to be 100% secure.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">10. User Rights</h2>
                    <p className="mb-4">Depending on applicable law, users may have the right to:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Access their personal data</li>
                        <li>Request correction or deletion</li>
                        <li>Restrict or object to processing</li>
                        <li>Request data portability</li>
                    </ul>
                    <p className="mb-6">
                        Requests can be made by contacting us at the email address below.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">11. Changes to This Policy</h2>
                    <p className="mb-4">We may update this Privacy Policy from time to time.</p>
                    <p className="mb-6">
                        Changes will be posted on this page with an updated &#8220;Last updated&#8221; date.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">12. Contact</h2>
                    <p className="mb-4">
                        If you have questions about this Privacy Policy or data protection matters, contact:
                    </p>
                    <p className="mb-6">
                        <strong>Email:</strong> info@vibe-vaults.com
                    </p>
                </div>
            </main>

            <footer className="py-8 w-full border-t border-gray-100 bg-gray-50 mt-12">
                <div className="max-w-3xl mx-auto px-8 text-center text-sm text-gray-500">
                    © {new Date().getFullYear()} VibeVaults. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
