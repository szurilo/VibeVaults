
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

export default function RegisterPage() {
    return (
        <Suspense>
            <AuthForm mode="register" socialProviders={<GoogleSignInButton />} />
        </Suspense>
    );
}
