'use client';

import { useRouter } from "next/navigation";
import { DangerZoneCard } from "@/components/DangerZoneCard";
import { deleteProjectAction } from "@/actions/projects";

interface DeleteProjectCardProps {
    project: {
        id: string;
        name: string;
    };
}

export function DeleteProjectCard({ project }: DeleteProjectCardProps) {
    const router = useRouter();

    const handleDeleteProject = async () => {
        if (!project) return;

        const result = await deleteProjectAction(project.id);
        if (result?.error) throw new Error(result.error);

        document.cookie = 'selectedProjectId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        router.push("/dashboard");
        router.refresh();
    };

    return (
        <DangerZoneCard
            entityName="Project"
            description={<>Permanently delete <span className="font-semibold text-gray-700">{project.name}</span> and all its feedbacks.</>}
            dialogTitle={`Delete project "${project.name}"?`}
            dialogDescription="This action cannot be undone. This will permanently delete your project and all the feedback associated with it."
            onDelete={handleDeleteProject}
        />
    );
}
