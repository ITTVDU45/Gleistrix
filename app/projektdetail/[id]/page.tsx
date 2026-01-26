import ProjectDetailClient from '../../../components/ProjectDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Next.js 15: params ist ein Promise und muss mit await aufgelöst werden.
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ProjectDetailClient projectId={id} />;
}