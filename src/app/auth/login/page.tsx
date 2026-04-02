
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

export default function LoginPage() {
    return (
        <Suspense>
            <AuthForm mode="login" socialProviders={<GoogleSignInButton />} />
        </Suspense>
    );
}
