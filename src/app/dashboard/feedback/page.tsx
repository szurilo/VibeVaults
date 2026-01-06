import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function FeedbackListPage() {
    const session = await getSession();
    if (!session) redirect("/login");

    const feedbacks = await prisma.feedback.findMany({
        where: {
            project: {
                userId: session.user.id
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '2rem' }}>Incoming Feedback</h1>

            {feedbacks.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>No feedback received yet.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {feedbacks.map(item => (
                        <div key={item.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 600
                                }}>
                                    {item.type}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <p style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
                                {item.content}
                            </p>
                            {item.sender && (
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                                    From: {item.sender}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
