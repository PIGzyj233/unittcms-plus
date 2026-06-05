'use client';

import { FC } from 'react';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import clsx from 'clsx';
import { Button } from '@/components/heroui';

import { SunFilledIcon, MoonFilledIcon } from '@/components/icons';

export interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isLight = !mounted || resolvedTheme !== 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  const onChange = () => {
    if (isLight) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  return (
    <Button
      isIconOnly
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      aria-pressed={!isLight}
      className={clsx('px-px transition-opacity hover:opacity-80 cursor-pointer', className)}
      variant="ghost"
      onPress={onChange}
    >
      {isLight ? <SunFilledIcon size={22} /> : <MoonFilledIcon size={22} />}
    </Button>
  );
};
