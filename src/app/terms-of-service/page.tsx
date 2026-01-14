
import Link from "next/link";

export default function TermsOfService() {
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
                <h1 className="text-4xl font-extrabold mb-4 text-gray-900">Terms of Service</h1>
                <p className="text-gray-500 mb-8">
                    <strong>Last updated:</strong> January 14, 2026
                </p>

                <div className="prose prose-gray max-w-none">
                    <p className="mb-6">
                        These Terms of Service (&#8220;Terms&#8221;) govern your use of VibeVaults (the &#8220;Service&#8221;), operated by József Tar (&#8220;we&#8221;, &#8220;us&#8221;, &#8220;our&#8221;).
                    </p>
                    <p className="mb-6">
                        By accessing or using the Service, you agree to these Terms.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">1. The Service</h2>
                    <p className="mb-4">
                        We provide a hosted feedback widget and an administrative dashboard that allows customers to collect and manage feedback submitted by end users.
                    </p>
                    <p className="mb-6">
                        The Service is provided on an &#8220;as is&#8221; and &#8220;as available&#8221; basis.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">2. Accounts</h2>
                    <p className="mb-4">To use the administrative dashboard, you must create an account.</p>
                    <p className="mb-4">You are responsible for:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>maintaining the confidentiality of your login credentials</li>
                        <li>all activity that occurs under your account</li>
                    </ul>
                    <p className="mb-6">
                        You must provide accurate and up-to-date information.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">3. Acceptable Use</h2>
                    <p className="mb-4">You agree not to use the Service to:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>submit or collect illegal, harmful, or abusive content</li>
                        <li>send spam or automated submissions</li>
                        <li>violate applicable laws or regulations</li>
                        <li>interfere with or disrupt the Service</li>
                    </ul>
                    <p className="mb-6">
                        We reserve the right to suspend or terminate accounts that violate these rules.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">4. User Content and Feedback</h2>
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

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">5. Payments and Subscriptions</h2>
                    <p className="mb-4">Paid subscriptions are processed by <strong>Stripe</strong>, a third-party payment provider.</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>Prices are listed on our website and may change in the future.</li>
                        <li>Subscriptions are billed on a recurring basis.</li>
                        <li>Unless otherwise stated, fees are non-refundable.</li>
                    </ul>
                    <p className="mb-6">
                        You may cancel your subscription at any time. Upon cancellation, access to paid features may be limited or disabled at the end of the billing period.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">6. Availability and Support</h2>
                    <p className="mb-4">
                        We strive to keep the Service available, but we do not guarantee uninterrupted or error-free operation.
                    </p>
                    <p className="mb-6">
                        We do not provide a guaranteed uptime or service-level agreement (SLA) for the Service.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">7. Third-Party Services</h2>
                    <p className="mb-4">
                        The Service relies on third-party infrastructure and services, including but not limited to:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li><strong>Supabase</strong> (authentication and database)</li>
                        <li><strong>Vercel</strong> (hosting and deployment)</li>
                        <li><strong>Stripe</strong> (payment processing)</li>
                    </ul>
                    <p className="mb-6">
                        We are not responsible for outages or failures caused by these providers.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">8. Limitation of Liability</h2>
                    <p className="mb-4">To the maximum extent permitted by law:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>We shall not be liable for indirect, incidental, or consequential damages.</li>
                        <li>Our total liability related to the Service shall not exceed the amount you paid us in the last 12 months.</li>
                    </ul>
                    <p className="mb-6">
                        You use the Service at your own risk.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">9. Termination</h2>
                    <p className="mb-4">You may stop using the Service at any time.</p>
                    <p className="mb-4">We may suspend or terminate your access if:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                        <li>you violate these Terms</li>
                        <li>you use creates legal or technical risk</li>
                    </ul>
                    <p className="mb-6">
                        Upon termination, your access to the Service will be discontinued.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">10. Changes to These Terms</h2>
                    <p className="mb-4">We may update these Terms from time to time.</p>
                    <p className="mb-6">
                        Updated versions will be posted on our website with a revised &#8220;Last updated&#8221; date.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">11. Governing Law</h2>
                    <p className="mb-6">
                        These Terms are governed by the laws of <strong>Hungary / European Union</strong>, without regard to conflict of law principles.
                    </p>

                    <hr className="my-8 border-gray-100" />

                    <h2 className="text-2xl font-bold mb-4 text-gray-900">12. Contact</h2>
                    <p className="mb-4">
                        If you have questions about these Terms, contact us at:
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
