import Link from 'next/link'

export default function AuthCodeError() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full space-y-8 text-center">
                <div>
                    <div className="mx-auto h-12 w-12 text-red-600">
                        <svg
                            className="h-full w-full"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                        Authentication Error
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        We couldn't complete your authentication request.
                    </p>
                </div>

                <div className="bg-white shadow rounded-lg p-6 text-left">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Possible reasons:
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-600">
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>The verification link has expired</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>The link has already been used</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>The link is invalid or corrupted</span>
                        </li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <Link
                        href="/login"
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Try logging in again
                    </Link>
                    <Link
                        href="/register"
                        className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Create a new account
                    </Link>
                </div>

                <p className="text-xs text-gray-500">
                    If you continue to experience issues, please contact support.
                </p>
            </div>
        </div>
    )
}
