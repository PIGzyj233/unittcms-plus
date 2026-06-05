'use client';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Image from 'next/image';

type Props = {
  imageName: string;
  altText: string;
};

export default function DemoImage({ imageName, altText }: Props) {
  const { theme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState('light');

  useEffect(() => {
    if (theme) {
      setCurrentTheme(theme);
    }
  }, [theme]);

  return (
    <>
      <Image
        src={`/top/${currentTheme}/${imageName}.png`}
        alt={altText}
        width={960}
        height={540}
        className="max-w-full"
      />
    </>
  );
}
