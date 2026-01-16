'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Onboarding() {
    const router = useRouter();
    const [projectName, setProjectName] = useState('');
    const [isDismissed, setIsDismissed] = useState(false);

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim()) return;

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projectName }),
            });

            if (res.ok) {
                const newProject = await res.json();
                document.cookie = `selectedProjectId=${newProject.id}; path=/; max-age=31536000`;
                router.refresh();
            }
        } catch (error) {
            console.error('Failed to create project:', error);
        }
    };

    if (isDismissed) return null;

    return (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 mb-8 relative overflow-hidden">
            <div className="absolute top-4 right-4">
                <button
                    onClick={() => setIsDismissed(true)}
                    className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 hover:bg-gray-100 rounded-md"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="max-w-2xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to VibeVaults! 🚀</h2>
                <p className="text-gray-600 mb-6 text-lg">
                    Let's get started by creating your first project. Enter a name below to generate your API key and start collecting feedback.
                </p>

                <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        placeholder="e.g. My Awesome App"
                        className="flex-1 bg-white border border-gray-200 rounded-lg py-3 px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="bg-primary text-white font-semibold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                        Create Project
                    </button>
                </form>
            </div>
        </div>
    );
}
