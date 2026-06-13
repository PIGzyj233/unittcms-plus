'use client';
import { useState, useEffect } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  ChartColumnStacked,
  ClipboardList,
  Sparkles,
  FlaskConical,
  UserRound,
  Settings,
} from 'lucide-react';
import { Button, Tooltip } from '@/components/heroui';
import { usePathname, useRouter } from '@/src/i18n/routing';
import useGetCurrentIds from '@/utils/useGetCurrentIds';
import { ProjectMessages } from '@/types/project';

export type Props = {
  messages: ProjectMessages;
  locale: string;
};

export default function Sidebar({ messages, locale }: Props) {
  const { projectId } = useGetCurrentIds();
  const router = useRouter();
  const pathname = usePathname();

  const [currentKey, setCurrentKey] = useState('home');
  const [isSideBarOpen, setIsSideBarOpen] = useState(true);

  const TOGGLE_ICON_STROKE_WIDTH = 1;
  const TOGGLE_ICON_SIZE = 18;
  const ICON_STROKE_WIDTH = 1.8;
  const ICON_SIZE = 18;

  const handleClick = (key: string) => {
    if (key === 'home') {
      router.push(`/projects/${projectId}/home`, { locale: locale });
    } else if (key === 'cases') {
      router.push(`/projects/${projectId}/folders`, { locale: locale });
    } else if (key === 'caseCandidates') {
      router.push(`/projects/${projectId}/case-candidates`, { locale: locale });
    } else if (key === 'runs') {
      router.push(`/projects/${projectId}/runs`, { locale: locale });
    } else if (key === 'members') {
      router.push(`/projects/${projectId}/members`, { locale: locale });
    } else if (key === 'settings') {
      router.push(`/projects/${projectId}/settings`, { locale: locale });
    }
  };

  useEffect(() => {
    const handleRouteChange = (currentPath: string) => {
      if (currentPath.includes('home')) {
        setCurrentKey('home');
      } else if (currentPath.includes('folders')) {
        setCurrentKey('cases');
      } else if (currentPath.includes('case-candidates')) {
        setCurrentKey('caseCandidates');
      } else if (currentPath.includes('runs')) {
        setCurrentKey('runs');
      } else if (currentPath.includes('members')) {
        setCurrentKey('members');
      } else if (currentPath.includes('settings')) {
        setCurrentKey('settings');
      }
    };

    handleRouteChange(pathname);
  }, [pathname]);

  const tabItems = [
    {
      key: 'home',
      text: messages.home,
      startContent: <ChartColumnStacked strokeWidth={ICON_STROKE_WIDTH} size={ICON_SIZE} />,
    },
    {
      key: 'cases',
      text: messages.testCases,
      startContent: <ClipboardList strokeWidth={ICON_STROKE_WIDTH} size={ICON_SIZE} />,
    },
    {
      key: 'caseCandidates',
      text: messages.caseCandidates,
      startContent: <Sparkles strokeWidth={ICON_STROKE_WIDTH} size={ICON_SIZE} />,
    },
    {
      key: 'runs',
      text: messages.testRuns,
      startContent: <FlaskConical strokeWidth={ICON_STROKE_WIDTH} size={ICON_SIZE} />,
    },
    {
      key: 'members',
      text: messages.members,
      startContent: <UserRound strokeWidth={ICON_STROKE_WIDTH} size={ICON_SIZE} />,
    },
    {
      key: 'settings',
      text: messages.settings,
      startContent: <Settings strokeWidth={ICON_STROKE_WIDTH} size={ICON_SIZE} />,
    },
  ];

  const renderNavButton = (itr: (typeof tabItems)[number], compact = false) => (
    <div key={itr.key} className="block w-full">
      <Tooltip hidden={isSideBarOpen || !compact} content={itr.text} placement="right">
        <button
          type="button"
          aria-current={itr.key === currentKey ? 'page' : undefined}
          className={[
            'flex h-10 min-w-0 items-center rounded-md text-sm font-medium transition-colors',
            compact ? 'mx-auto w-10 justify-center p-0' : 'w-full justify-start gap-3 px-3',
            itr.key === currentKey
              ? 'bg-neutral-950 text-white shadow-sm hover:bg-neutral-950 dark:bg-white dark:text-neutral-950 dark:hover:bg-white'
              : 'text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white',
          ].join(' ')}
          onClick={() => handleClick(itr.key)}
        >
          {itr.startContent}
          {!compact && <span className="truncate">{itr.text}</span>}
        </button>
      </Tooltip>
    </div>
  );

  return (
    <>
      <div className="sticky top-16 z-30 border-b border-black/10 bg-white/90 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-neutral-950/90 md:hidden">
        <nav className="flex gap-2 overflow-x-auto">
          {tabItems.map((itr) => (
            <Button
              key={itr.key}
              size="sm"
              startContent={itr.startContent}
              variant="light"
              aria-current={itr.key === currentKey ? 'page' : undefined}
              className={[
                'h-9 shrink-0 rounded-md px-3 text-sm font-medium',
                itr.key === currentKey
                  ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                  : 'text-neutral-600 dark:text-neutral-300',
              ].join(' ')}
              onPress={() => handleClick(itr.key)}
            >
              {itr.text}
            </Button>
          ))}
        </nav>
      </div>
      <aside
        className={[
          'sticky top-16 hidden h-[calc(100vh-64px)] shrink-0 border-r border-black/10 bg-white/80 transition-[width] duration-200 dark:border-white/10 dark:bg-neutral-950/70 md:block',
          isSideBarOpen ? 'w-52' : 'w-16',
        ].join(' ')}
      >
        <div className="flex h-12 items-center justify-end border-b border-black/10 px-2 dark:border-white/10">
          <Tooltip content={messages.toggleSidebar} placement="right">
            <Button
              size="sm"
              isIconOnly
              variant="light"
              className="text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              onPress={() => setIsSideBarOpen(!isSideBarOpen)}
            >
              {isSideBarOpen ? (
                <PanelLeftClose strokeWidth={TOGGLE_ICON_STROKE_WIDTH} size={TOGGLE_ICON_SIZE} />
              ) : (
                <PanelLeftOpen strokeWidth={TOGGLE_ICON_STROKE_WIDTH} size={TOGGLE_ICON_SIZE} />
              )}
            </Button>
          </Tooltip>
        </div>

        <nav className="space-y-1 p-2">{tabItems.map((itr) => renderNavButton(itr, !isSideBarOpen))}</nav>
      </aside>
    </>
  );
}
