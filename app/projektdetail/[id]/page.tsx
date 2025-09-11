import ProjectDetailClient from '../../../components/ProjectDetailClient';

// Next 15 kann buildseitig param props als Promise typisieren.
// Wir akzeptieren hier generisch any und lesen synchron heraus.
export default function Page(context: any) {
  const id = (context?.params as any)?.id as string;
  return <ProjectDetailClient projectId={id} />;
}