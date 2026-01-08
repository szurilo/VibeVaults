export default function DashboardPage() {
    return (
        <div>
            <h1 className="text-2xl font-semibold mb-8 text-gray-900">Overview</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Total Feedback</h3>
                    <p className="text-3xl font-bold text-gray-900">0</p>
                </div>

            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mt-8">
                <h2 className="text-lg font-semibold mb-4 text-gray-900">Get Started</h2>
                <p className="text-gray-500 mb-6">
                    Embed the widget on your site to start collecting feedback and displaying updates.
                </p>
                <div className="bg-gray-50 p-4 rounded-md font-mono text-sm text-gray-800">
                    &lt;script src="https://vibevault.app/widget.js"&gt;&lt;/script&gt;
                </div>
            </div>
        </div>
    );
}
