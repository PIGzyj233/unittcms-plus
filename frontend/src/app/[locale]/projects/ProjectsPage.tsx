'use client';
import { useEffect, useState, useContext } from 'react';
import { Plus } from 'lucide-react';
import ProjectsTable from './ProjectsTable';
import { Button } from '@/components/heroui';
import { TokenContext } from '@/utils/TokenProvider';
import { ProjectDialogMessages, ProjectType, ProjectsMessages } from '@/types/project';
import ProjectDialog from '@/components/ProjectDialog';
import { fetchProjects, createProject } from '@/utils/projectsControl';
import { LocaleCodeType } from '@/types/locale';
import { logError } from '@/utils/errorHandler';

export type Props = {
  messages: ProjectsMessages;
  projectDialogMessages: ProjectDialogMessages;
  locale: LocaleCodeType;
};

export default function ProjectsPage({ messages, projectDialogMessages, locale }: Props) {
  const context = useContext(TokenContext);
  const [projects, setProjects] = useState<ProjectType[]>([]);

  useEffect(() => {
    async function fetchDataEffect() {
      if (!context.isSignedIn()) {
        return;
      }
      try {
        const data = await fetchProjects(context.token.access_token);
        setProjects(data);
      } catch (error: unknown) {
        logError('Error fetching data:', error);
      }
    }

    fetchDataEffect();
  }, [context]);

  // project dialog
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectType | null>(null);
  const openDialogForCreate = () => {
    setIsProjectDialogOpen(true);
    setEditingProject(null);
  };

  const closeDialog = () => {
    setIsProjectDialogOpen(false);
    setEditingProject(null);
  };

  const onSubmit = async (name: string, detail: string, isPublic: boolean) => {
    const newProject = await createProject(context.token.access_token, name, detail, isPublic);
    setProjects([...projects, newProject]);

    // refresh project roles
    context.refreshProjectRoles();
    closeDialog();
  };

  return (
    <div className="workspace-page">
      <section className="workspace-surface overflow-hidden">
        <div className="workspace-toolbar">
          <h3 className="workspace-section-title">{messages.projectList}</h3>
          <Button startContent={<Plus size={16} />} size="sm" color="primary" onPress={openDialogForCreate}>
            {messages.newProject}
          </Button>
        </div>

        <div className="workspace-table-wrap">
          <ProjectsTable projects={projects} messages={messages} locale={locale} />
        </div>
      </section>

      <ProjectDialog
        isOpen={isProjectDialogOpen}
        editingProject={editingProject}
        onCancel={closeDialog}
        onSubmit={onSubmit}
        projectDialogMessages={projectDialogMessages}
      />
    </div>
  );
}
