'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProjectSwitcher({
    projects,
    selectedProjectId
}: {
    projects: any[],
    selectedProjectId?: string
}) {
    const router = useRouter();
    const [isCreating, setIsCreating] = useState(false);
    const [projectName, setProjectName] = useState('');

    const handleProjectChange = (projectId: string) => {
        document.cookie = `selectedProjectId=${projectId}; path=/; max-age=31536000`;
        router.refresh();
    };

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
                setProjectName('');
                setIsCreating(false);
                router.refresh();
            }
        } catch (error) {
            console.error('Failed to create project:', error);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">
                    Your Projects
                </label>
                <div className="px-3">
                    <select
                        className="w-full bg-white border border-gray-200 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer hover:border-primary/50 transition-colors"
                        value={selectedProjectId || ''}
                        onChange={(e) => handleProjectChange(e.target.value)}
                    >
                        <option value="" disabled>Select a project</option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="px-3">
                {isCreating ? (
                    <form onSubmit={handleCreateProject} className="space-y-2">
                        <input
                            type="text"
                            placeholder="Project name"
                            className="w-full border border-gray-200 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="flex-1 bg-primary text-white text-xs font-semibold py-2 rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
                            >
                                Create
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="flex-1 bg-gray-100 text-gray-600 text-xs font-semibold py-2 rounded-md hover:bg-gray-200 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-600 hover:border-primary hover:text-primary transition-all cursor-pointer bg-white active:bg-gray-50"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Project
                    </button>
                )}
            </div>
        </div>
    );
}
