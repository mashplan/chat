'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  CheckCircleFillIcon,
  ChevronDownIcon,
  GlobeIcon,
  LockIcon,
} from './icons';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useTranslations } from 'next-intl';

export type VisibilityType = 'private' | 'public';

export function VisibilitySelector({
  chatId,
  className,
  selectedVisibilityType,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
} & React.ComponentProps<typeof Button>) {
  const t = useTranslations('Chat.Visibility');
  const [open, setOpen] = useState(false);
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId,
    initialVisibilityType: selectedVisibilityType,
  });

  const visibilities = useMemo(
    () => [
      {
        id: 'private' as const,
        label: t('privateTitle'),
        description: t('privateDescription'),
        icon: <LockIcon />,
      },
      {
        id: 'public' as const,
        label: t('publicTitle'),
        description: t('publicDescription'),
        icon: <GlobeIcon />,
      },
    ],
    [t],
  );

  const selectedVisibility = useMemo(
    () => visibilities.find((visibility) => visibility.id === visibilityType),
    [visibilityType, visibilities],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        asChild
        className={cn(
          'w-fit data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          className,
        )}
      >
        <Button
          data-testid="visibility-selector"
          variant="outline"
          className="hidden focus:outline-hidden focus:ring-0 md:flex md:h-fit md:px-2"
        >
          {selectedVisibility?.icon}
          {selectedVisibility?.label}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[300px]">
        {visibilities.map((visibility) => (
          <DropdownMenuItem
            data-testid={`visibility-selector-item-${visibility.id}`}
            key={visibility.id}
            onSelect={() => {
              setVisibilityType(visibility.id);
              setOpen(false);
            }}
            className="group/item flex flex-row items-center justify-between gap-4"
            data-active={visibility.id === visibilityType}
          >
            <div className="flex flex-col items-start gap-1">
              {visibility.label}
              {visibility.description && (
                <div className="text-muted-foreground text-xs">
                  {visibility.description}
                </div>
              )}
            </div>
            <div className="text-foreground opacity-0 group-data-[active=true]/item:opacity-100 dark:text-foreground">
              <CheckCircleFillIcon />
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
