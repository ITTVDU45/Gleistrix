import ProjectDetailClient from '../../../components/ProjectDetailClient';

export default function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  return <ProjectDetailClient projectId={id} />;
}