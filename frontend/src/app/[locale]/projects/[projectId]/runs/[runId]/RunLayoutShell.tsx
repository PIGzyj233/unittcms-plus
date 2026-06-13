'use client';

import { RunExecutionProvider } from './RunExecutionContext';
import ResizablePanes from '@/components/ResizablePane';

type Props = {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
};

export default function RunLayoutShell({ leftPane, rightPane }: Props) {
  return (
    <RunExecutionProvider>
      <ResizablePanes leftPane={leftPane} rightPane={rightPane} />
    </RunExecutionProvider>
  );
}
