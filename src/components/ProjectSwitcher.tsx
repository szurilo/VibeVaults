'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PlusIcon } from 'lucide-react';

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
            <div className="space-y-1.5 px-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Your Projects
                </Label>
                <Select
                    value={selectedProjectId || ''}
                    onValueChange={handleProjectChange}
                    disabled={projects.length < 2}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                        {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                                {project.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="px-3">
                {isCreating ? (
                    <form onSubmit={handleCreateProject} className="space-y-2">
                        <Input
                            type="text"
                            placeholder="Project name"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <Button type="submit" className="flex-1" size="sm">
                                Create
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreating(false)}
                                className="flex-1"
                                size="sm"
                            >
                                Cancel
                            </Button>
                        </div>
                    </form>
                ) : (
                    <Button
                        variant="outline"
                        onClick={() => setIsCreating(true)}
                        className="w-full border-dashed justify-center gap-2"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Create Project
                    </Button>
                )}
            </div>
        </div>
    );
}
