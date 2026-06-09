'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import * as React from 'react';
import * as Hero from '@heroui/react';
import clsx from 'clsx';
import { Check, Loader2 } from 'lucide-react';

export * from '@heroui/react';
export type { Selection, SortDescriptor } from '@heroui/react';

type V3SelectionSet = Set<React.Key> & { currentKey?: React.Key };
type V3Selection = 'all' | V3SelectionSet;
type V3InputBridgeProps = Omit<React.ComponentProps<'input'>, 'size'> & {
  label?: React.ReactNode;
  errorMessage?: React.ReactNode;
  description?: React.ReactNode;
  isInvalid?: boolean;
  inputClassName?: string;
  classNames?: {
    base?: string;
    input?: string;
    mainWrapper?: string;
    inputWrapper?: string;
  };
  onValueChange?: (value: string) => void;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  size?: string;
  variant?: string;
  fullWidth?: boolean;
};
type V3TextAreaBridgeProps = Omit<React.ComponentProps<'textarea'>, 'size'> & {
  label?: React.ReactNode;
  errorMessage?: React.ReactNode;
  description?: React.ReactNode;
  isInvalid?: boolean;
  onValueChange?: (value: string) => void;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  minRows?: number;
  maxRows?: number;
  size?: string;
  variant?: string;
  fullWidth?: boolean;
};
type V3SelectBridgeProps = {
  children?: React.ReactNode;
  label?: React.ReactNode;
  selectedKeys?: Iterable<React.Key> | 'all';
  disabledKeys?: Iterable<React.Key>;
  onSelectionChange?: (keys: any) => void;
  startContent?: React.ReactNode;
  className?: string;
  size?: string;
  variant?: string;
  fullWidth?: boolean;
  [key: string]: unknown;
};
type ComboBoxProps = {
  children?: React.ReactNode;
  label?: React.ReactNode;
  selectedKey?: React.Key | null;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onSelectionChange?: (key: React.Key | null) => void;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
  ref?: React.Ref<HTMLElement>;
  size?: string;
  variant?: string;
  defaultItems?: Iterable<unknown>;
  items?: Iterable<unknown>;
  [key: string]: unknown;
};

function mapButtonVariant(variant?: string, color?: string) {
  if (color === 'danger') return 'danger';
  if (variant === 'bordered') return 'outline';
  if (variant === 'light') return 'ghost';
  if (variant === 'flat') return 'secondary';
  return variant;
}

function selectedKeyFromKeys(selectedKeys: unknown) {
  if (selectedKeys === 'all') return undefined;
  if (selectedKeys instanceof Set) return selectedKeys.values().next().value;
  if (Array.isArray(selectedKeys)) return selectedKeys[0];
  return selectedKeys as React.Key | undefined;
}

function selectedSetFromKey(key: React.Key | null) {
  const set = (key == null ? new Set<React.Key>() : new Set<React.Key>([key])) as V3SelectionSet;
  if (key != null) set.currentKey = key;
  return set;
}

function toKeySet(keys: unknown): V3Selection {
  if (keys === 'all') return 'all';
  if (keys instanceof Set) return keys;
  if (Array.isArray(keys)) return new Set(keys);
  if (keys == null) return new Set();
  return new Set([keys as React.Key]);
}

function collectionChildrenWithIds(children: React.ReactNode) {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return child;
    const id = child.props.id ?? child.key ?? child.props.textValue;
    if (id == null) return child;
    const textValue =
      child.props.textValue ??
      (typeof child.props.title === 'string'
        ? child.props.title
        : typeof child.props.children === 'string'
          ? child.props.children
          : String(id));
    return React.cloneElement(child, { id, textValue });
  });
}

export function addToast({
  title,
  description,
  color,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}) {
  const variant = color === 'primary' || color === 'secondary' ? 'accent' : color;
  return Hero.toast(title ?? description ?? '', {
    description: title ? description : undefined,
    variant: variant === 'default' ? undefined : variant,
  });
}

export const ToastProvider = Hero.ToastProvider;

export const cn = clsx;
export function Card({ shadow: _shadow, radius: _radius, ...props }: any) {
  return <Hero.Card {...props} />;
}

export const CardHeader = Hero.CardHeader as any;
export const CardBody = Hero.CardContent as any;
export const CardFooter = Hero.CardFooter as any;

export function Avatar({ src, name, ...props }: any) {
  return (
    <Hero.Avatar {...props}>
      {src ? <Hero.Avatar.Image src={src} alt={name ?? ''} /> : null}
      <Hero.Avatar.Fallback>{name?.slice?.(0, 2) ?? ''}</Hero.Avatar.Fallback>
    </Hero.Avatar>
  );
}

export const Spinner = Hero.Spinner as any;

export function Link({ showAnchorIcon, children, ...props }: any) {
  return (
    <Hero.Link {...props}>
      {children}
      {showAnchorIcon ? <span aria-hidden="true">↗</span> : null}
    </Hero.Link>
  );
}

export function Chip({ children, startContent, endContent, variant, color, className, ...props }: any) {
  return (
    <Hero.Chip
      {...props}
      className={className}
      color={color === 'primary' ? 'accent' : color}
      variant={variant === 'flat' ? 'soft' : variant}
    >
      <span className="inline-flex items-center gap-1">
        {startContent}
        {children}
        {endContent}
      </span>
    </Hero.Chip>
  );
}

export function Badge({ children, content, isInvisible, className, ...props }: any) {
  return (
    <span className={['relative inline-flex', className].filter(Boolean).join(' ')} {...props}>
      {children}
      {!isInvisible && (
        <span className="absolute -right-1 -top-1 flex min-h-3 min-w-3 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-3 text-danger-foreground">
          {content}
        </span>
      )}
    </span>
  );
}

export function Alert({ children, title, description, color, status, ...props }: any) {
  return (
    <Hero.Alert {...props} status={status ?? color}>
      {children ?? (
        <Hero.Alert.Content>
          {title && <Hero.Alert.Title>{title}</Hero.Alert.Title>}
          {description && <Hero.Alert.Description>{description}</Hero.Alert.Description>}
        </Hero.Alert.Content>
      )}
    </Hero.Alert>
  );
}

type V3TabsBridgeProps = {
  children?: React.ReactNode;
  selectedKey?: React.Key;
  onSelectionChange?: (key: React.Key) => void;
  className?: string;
  size?: string;
  [key: string]: unknown;
};

function normalizeCollectionKey(key: React.Key | null): React.Key | undefined {
  if (key == null) return undefined;
  if (typeof key !== 'string') return key;

  const withoutReactPrefix = key.startsWith('.$') ? key.slice(2) : key.startsWith('.') ? key.slice(1) : key;
  return withoutReactPrefix.replace(/=0/g, '=').replace(/=2/g, ':');
}

function tabKey(tab: React.ReactElement<any>): React.Key | undefined {
  return (tab.props.id as React.Key | undefined) ?? normalizeCollectionKey(tab.key);
}

export function Tabs({ children, selectedKey, onSelectionChange, className, ...props }: V3TabsBridgeProps) {
  const tabs = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<any>[];
  const activeKey = selectedKey ?? (tabs[0] ? tabKey(tabs[0]) : undefined);
  return (
    <div className={className} {...props}>
      <div className="flex gap-1 border-b border-separator">
        {tabs.map((tab) => {
          const key = tabKey(tab);
          const isActive = String(key) === String(activeKey);
          return (
            <button
              key={String(key)}
              className={[
                'px-3 py-2 text-sm transition-colors',
                isActive ? 'border-b-2 border-accent text-accent' : 'text-muted hover:text-foreground',
              ].join(' ')}
              type="button"
              onClick={() => {
                if (key != null) onSelectionChange?.(key);
              }}
            >
              {tab.props.title ?? tab.props.children}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const key = tabKey(tab);
        return String(key) === String(activeKey) ? (
          <div key={String(key)} className="py-3">
            {tab.props.children}
          </div>
        ) : null;
      })}
    </div>
  );
}

export function Tab(_props: any) {
  return null;
}

export function Tooltip({ children, content, placement, ...props }: any) {
  return (
    <Hero.Tooltip {...props}>
      <Hero.Tooltip.Trigger>{children}</Hero.Tooltip.Trigger>
      <Hero.Tooltip.Content placement={placement}>{content}</Hero.Tooltip.Content>
    </Hero.Tooltip>
  );
}

export function Button({
  startContent,
  endContent,
  isLoading,
  isDisabled,
  children,
  variant,
  color,
  as: Component,
  className,
  isIconOnly,
  onPress,
  radius: _radius,
  size,
  ...props
}: any) {
  if (Component) {
    return (
      <Component
        {...props}
        aria-disabled={isDisabled || isLoading || undefined}
        className={legacyButtonClassName({ className, color, isIconOnly, size, variant })}
        onClick={onPress}
        role={props.role ?? 'button'}
        tabIndex={isDisabled || isLoading ? -1 : props.tabIndex}
      >
        {buttonChildren({ startContent, endContent, isLoading, children })}
      </Component>
    );
  }

  return (
    <Hero.Button
      {...props}
      className={className}
      isDisabled={Boolean(isDisabled || isLoading)}
      isIconOnly={isIconOnly}
      onPress={onPress}
      size={size}
      variant={mapButtonVariant(variant, color) as any}
    >
      {isLoading ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : startContent}
      {children}
      {endContent}
    </Hero.Button>
  );
}

function buttonChildren({ startContent, endContent, isLoading, children }: any) {
  return (
    <>
      {isLoading ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : startContent}
      {children}
      {endContent}
    </>
  );
}

function legacyButtonClassName({ className, color, isIconOnly, size, variant }: any) {
  const isPlainVariant = variant === 'light' || variant === 'ghost';
  return [
    'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium transition-colors',
    size === 'sm' ? 'px-2 py-1' : 'px-3 py-2',
    isIconOnly ? 'aspect-square px-2' : '',
    variant === 'bordered' ? 'border border-field-border bg-background hover:bg-default-100' : '',
    variant === 'light' || variant === 'ghost' ? 'bg-transparent hover:bg-default-100' : '',
    variant === 'flat' ? 'bg-default-100 hover:bg-default-200' : '',
    color === 'primary'
      ? isPlainVariant
        ? 'text-primary'
        : 'bg-primary text-primary-foreground hover:opacity-90'
      : '',
    color === 'danger' ? (isPlainVariant ? 'text-danger' : 'bg-danger text-danger-foreground hover:opacity-90') : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

function fieldClassName(className?: string) {
  return ['flex w-full flex-col gap-1', className].filter(Boolean).join(' ');
}

function fieldInputClassName(className?: string, isInvalid?: boolean) {
  return [
    'w-full rounded-field border border-field-border bg-field px-3 py-2 text-sm text-field-foreground shadow-field outline-none transition-colors placeholder:text-field-placeholder focus:border-field-border-focus focus:ring-2 focus:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-50',
    isInvalid ? 'border-danger focus:border-danger focus:ring-danger/20' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

function FieldLabel({ children, isRequired }: { children: React.ReactNode; isRequired?: boolean }) {
  return (
    <span className="text-sm text-foreground">
      {children}
      {isRequired ? '*' : null}
    </span>
  );
}

export function Input({
  label,
  errorMessage,
  description,
  isInvalid,
  className,
  inputClassName,
  classNames,
  onValueChange,
  startContent,
  endContent,
  ...props
}: V3InputBridgeProps) {
  const {
    size: _size,
    variant: _variant,
    fullWidth: _fullWidth,
    isDisabled,
    isReadOnly,
    isRequired,
    ...inputProps
  } = props;
  return (
    <label className={fieldClassName([className, classNames?.base].filter(Boolean).join(' '))}>
      {label && <FieldLabel isRequired={isRequired}>{label}</FieldLabel>}
      <span className="relative flex items-center">
        {startContent && <span className="absolute left-3 text-muted">{startContent}</span>}
        <Hero.Input
          {...inputProps}
          aria-invalid={isInvalid || undefined}
          disabled={isDisabled}
          readOnly={isReadOnly}
          required={isRequired}
          className={fieldInputClassName(
            [startContent ? 'pl-10' : '', endContent ? 'pr-10' : '', inputClassName, classNames?.input]
              .filter(Boolean)
              .join(' '),
            isInvalid
          )}
          onChange={(event) => {
            inputProps.onChange?.(event);
            onValueChange?.(event.currentTarget.value);
          }}
        />
        {endContent && <span className="absolute right-3 text-muted">{endContent}</span>}
      </span>
      {description && <span className="text-xs text-muted">{description}</span>}
      {isInvalid && errorMessage && <span className="text-xs text-danger">{errorMessage}</span>}
    </label>
  );
}

export function TextArea({
  label,
  errorMessage,
  description,
  isInvalid,
  className,
  onValueChange,
  ...props
}: V3TextAreaBridgeProps) {
  const {
    size: _size,
    variant: _variant,
    fullWidth: _fullWidth,
    isDisabled,
    isReadOnly,
    isRequired,
    minRows,
    maxRows: _maxRows,
    ...textareaProps
  } = props;
  return (
    <label className={fieldClassName(className)}>
      {label && <FieldLabel isRequired={isRequired}>{label}</FieldLabel>}
      <Hero.TextArea
        {...textareaProps}
        aria-invalid={isInvalid || undefined}
        className={fieldInputClassName('min-h-24 resize-y', isInvalid)}
        disabled={isDisabled}
        readOnly={isReadOnly}
        required={isRequired}
        rows={minRows}
        onChange={(event) => {
          textareaProps.onChange?.(event);
          onValueChange?.(event.currentTarget.value);
        }}
      />
      {description && <span className="text-xs text-muted">{description}</span>}
      {isInvalid && errorMessage && <span className="text-xs text-danger">{errorMessage}</span>}
    </label>
  );
}

export function Checkbox({ children, isSelected, isDisabled, onValueChange, onChange, className, ...props }: any) {
  const disabled = Boolean(isDisabled || props.disabled);
  const accessibleLabel = props['aria-label'] ?? (typeof children === 'string' ? children : undefined);

  return (
    <label
      className={clsx(
        'inline-flex select-none items-center gap-2 rounded-small px-1 py-0.5 text-sm text-foreground transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-default-100',
        className
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        {...props}
        aria-label={accessibleLabel}
        checked={Boolean(isSelected)}
        className="sr-only"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => {
          onValueChange?.(event.currentTarget.checked);
          onChange?.(event);
        }}
      />
      <span
        aria-hidden="true"
        data-slot="checkbox-control"
        className={clsx(
          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-default-300 bg-background text-transparent'
        )}
      >
        <Check size={12} strokeWidth={3} />
      </span>
      {children && <span>{children}</span>}
    </label>
  );
}

export function Switch({ children, isSelected, onValueChange, onChange, ...props }: any) {
  return (
    <Hero.Switch
      {...props}
      isSelected={isSelected}
      onChange={(value) => {
        onValueChange?.(value);
        onChange?.(value);
      }}
    >
      {children}
    </Hero.Switch>
  );
}

export function Modal({ children, isOpen, onOpenChange, size, placement, scrollBehavior, ...props }: any) {
  return (
    <Hero.Modal {...props} isOpen={isOpen} onOpenChange={onOpenChange}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, { size, placement, scrollBehavior })
          : child
      )}
    </Hero.Modal>
  );
}

export function ModalContent({ children, size, placement, scrollBehavior, className }: any) {
  return (
    <Hero.Modal.Backdrop isDismissable>
      <Hero.Modal.Container size={size} placement={placement} scroll={scrollBehavior} className={className}>
        <Hero.Modal.Dialog>{typeof children === 'function' ? children() : children}</Hero.Modal.Dialog>
      </Hero.Modal.Container>
    </Hero.Modal.Backdrop>
  );
}

export const ModalHeader = Hero.Modal.Header;
export const ModalBody = Hero.Modal.Body;
export const ModalFooter = Hero.Modal.Footer;

type V3PopoverBridgeProps = {
  children?: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  placement?: string;
  [key: string]: unknown;
};

export function Popover({ children, isOpen, onOpenChange, ...props }: V3PopoverBridgeProps) {
  return (
    <Hero.Popover {...props} isOpen={isOpen} onOpenChange={onOpenChange}>
      {children}
    </Hero.Popover>
  );
}

export const PopoverTrigger = Hero.Popover.Trigger;
export function PopoverContent({ children, ...props }: any) {
  return (
    <Hero.Popover.Content {...props}>
      <Hero.Popover.Dialog>{children}</Hero.Popover.Dialog>
    </Hero.Popover.Content>
  );
}

export function Dropdown({ children, placement: _placement, ...props }: any) {
  return <Hero.Dropdown {...props}>{children}</Hero.Dropdown>;
}

export function DropdownTrigger({ children, ...props }: any) {
  if (React.isValidElement<any>(children)) {
    const {
      startContent,
      endContent,
      isLoading,
      isDisabled,
      children: buttonLabel,
      variant,
      color,
      className,
      ...buttonProps
    } = children.props;
    const triggerClassName = [
      'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-sm transition-colors',
      variant === 'bordered' ? 'border border-field-border bg-background hover:bg-default-100' : 'hover:bg-default-100',
      color === 'danger' ? 'text-danger' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <Hero.Dropdown.Trigger
        {...props}
        {...buttonProps}
        className={triggerClassName}
        isDisabled={Boolean(isDisabled || isLoading)}
      >
        {buttonChildren({ startContent, endContent, isLoading, children: buttonLabel })}
      </Hero.Dropdown.Trigger>
    );
  }

  return <Hero.Dropdown.Trigger {...props}>{children}</Hero.Dropdown.Trigger>;
}

export function DropdownMenu({ children, ...props }: any) {
  return (
    <Hero.Dropdown.Popover>
      <Hero.Dropdown.Menu {...props}>{collectionChildrenWithIds(children)}</Hero.Dropdown.Menu>
    </Hero.Dropdown.Popover>
  );
}

export function DropdownItem({ children, title, startContent, endContent, onPress, color, className, ...props }: any) {
  const variant = color === 'danger' ? 'danger' : undefined;
  return (
    <Hero.Dropdown.Item
      {...props}
      className={[className, color === 'danger' ? 'text-danger' : ''].filter(Boolean).join(' ')}
      onAction={onPress}
      variant={variant as any}
    >
      <span className="flex items-center gap-2">
        {startContent}
        <span>{title ?? children}</span>
        {endContent}
      </span>
    </Hero.Dropdown.Item>
  );
}

export function ListBox({ children, className, itemClasses, ...props }: any) {
  return (
    <Hero.ListBox
      {...props}
      className={[className, itemClasses?.base ? '[&_[role=option]]:' + itemClasses.base : '']
        .filter(Boolean)
        .join(' ')}
    >
      {collectionChildrenWithIds(children)}
    </Hero.ListBox>
  );
}

export function ListBoxItem({ children, title, startContent, endContent, onPress, ...props }: any) {
  return (
    <Hero.ListBox.Item {...props} onAction={onPress}>
      <span className="flex items-center gap-2">
        {startContent}
        <span>{title ?? children}</span>
        {endContent}
      </span>
    </Hero.ListBox.Item>
  );
}

export function Select<T extends object = object>({
  children,
  label,
  selectedKeys,
  onSelectionChange,
  startContent,
  className,
  ...props
}: V3SelectBridgeProps) {
  const selectedKey = selectedKeyFromKeys(selectedKeys);
  const { size: _size, variant: _variant, ...selectProps } = props;
  const HeroSelect = Hero.Select as any;
  return (
    <label className={fieldClassName(className)}>
      {label && <span className="text-sm text-foreground">{label}</span>}
      <HeroSelect
        {...selectProps}
        selectedKey={selectedKey}
        onSelectionChange={(key: React.Key | null) => onSelectionChange?.(selectedSetFromKey(key))}
      >
        <Hero.Select.Trigger>
          {startContent}
          <Hero.Select.Value />
          <Hero.Select.Indicator />
        </Hero.Select.Trigger>
        <Hero.Select.Popover>
          <Hero.ListBox>{collectionChildrenWithIds(children)}</Hero.ListBox>
        </Hero.Select.Popover>
      </HeroSelect>
    </label>
  );
}

export function SelectItem({ children, ...props }: any) {
  return <Hero.ListBox.Item {...props}>{children}</Hero.ListBox.Item>;
}

export function ComboBox({
  children,
  label,
  selectedKey,
  inputValue,
  onInputChange,
  onSelectionChange,
  className,
  ...props
}: ComboBoxProps) {
  const { size: _size, variant: _variant, defaultItems: _defaultItems, items: _items, ...autocompleteProps } = props;
  const HeroComboBox = Hero.ComboBox as any;
  return (
    <div className={fieldClassName(className)}>
      {label && <span className="text-sm text-foreground">{label}</span>}
      <HeroComboBox
        {...autocompleteProps}
        inputValue={inputValue}
        selectedKey={selectedKey}
        onInputChange={onInputChange}
        onSelectionChange={onSelectionChange}
      >
        <Hero.ComboBox.InputGroup>
          <Hero.Input className={fieldInputClassName()} />
          <Hero.ComboBox.Trigger />
        </Hero.ComboBox.InputGroup>
        <Hero.ComboBox.Popover>
          <Hero.ListBox>{collectionChildrenWithIds(children)}</Hero.ListBox>
        </Hero.ComboBox.Popover>
      </HeroComboBox>
    </div>
  );
}

export function ComboBoxItem({ children, ...props }: any) {
  return <Hero.ListBox.Item {...props}>{children}</Hero.ListBox.Item>;
}

export const Separator = Hero.Separator;

export function Table({
  children,
  onSortChange,
  sortDescriptor,
  selectionMode,
  selectedKeys,
  onSelectionChange,
  className,
  classNames,
  isCompact: _isCompact,
  hideHeader,
  ...props
}: any) {
  const childArray = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<any>[];
  const header = childArray.find((child) => (child.type as any).displayName === 'CompatTableHeader');
  const body = childArray.find((child) => (child.type as any).displayName === 'CompatTableBody');
  const columns =
    header?.props.columns ??
    React.Children.toArray(header?.props.children).map((child: any) => ({
      uid: child.key,
      name: child.props.children,
    }));
  const items = body?.props.items ?? [];
  const selected = toKeySet(selectedKeys);
  const selectedSet = selected === 'all' ? new Set(items.map((item: any) => item.id)) : selected;

  function toggleRow(id: React.Key) {
    if (!selectionMode) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.(next);
  }

  return (
    <div className={['overflow-x-auto', className, classNames?.wrapper].filter(Boolean).join(' ')} {...props}>
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        {header && !hideHeader && (
          <thead>
            <tr className="text-left text-muted">
              {selectionMode && <th className="border-b border-separator px-3 py-2" />}
              {columns.map((column: any) => {
                const columnElement =
                  typeof header.props.children === 'function'
                    ? header.props.children(column)
                    : React.Children.toArray(header.props.children).find((child: any) => child.key === column.uid);
                const allowsSorting = columnElement?.props?.allowsSorting;
                return (
                  <th
                    key={column.uid ?? column.id ?? column.key}
                    className="border-b border-separator px-3 py-2 font-medium"
                    onClick={() => {
                      if (!allowsSorting || !onSortChange) return;
                      const direction =
                        sortDescriptor?.column === column.uid && sortDescriptor?.direction === 'ascending'
                          ? 'descending'
                          : 'ascending';
                      onSortChange({ column: column.uid, direction });
                    }}
                  >
                    {columnElement?.props?.children ?? column.name}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody>
          {body && !body.props.items ? (
            React.Children.map(body.props.children, (row: any) => {
              if (!React.isValidElement(row)) return row;
              const rowElement = row as React.ReactElement<any>;
              return (
                <tr key={rowElement.key} className={rowElement.props.className}>
                  {React.Children.map(rowElement.props.children, (cell: any) => {
                    const cellElement = React.isValidElement(cell) ? (cell as React.ReactElement<any>) : null;
                    return (
                      <td className="border-b border-separator px-3 py-2">
                        {cellElement ? cellElement.props.children : cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          ) : items.length === 0 && body?.props.emptyContent ? (
            <tr>
              <td className="px-3 py-10 text-center text-muted" colSpan={columns.length + (selectionMode ? 1 : 0)}>
                {body.props.emptyContent}
              </td>
            </tr>
          ) : (
            items.map((item: any) => {
              const rowElement = typeof body?.props.children === 'function' ? body.props.children(item) : null;
              const rowId = rowElement?.key ?? item.id;
              return (
                <tr key={rowId} className={rowElement?.props.className}>
                  {selectionMode && (
                    <td className="border-b border-separator px-3 py-2">
                      <input
                        aria-label="Select row"
                        checked={selectedSet.has(rowId)}
                        type="checkbox"
                        onChange={() => toggleRow(rowId)}
                      />
                    </td>
                  )}
                  {columns.map((column: any) => (
                    <td key={column.uid ?? column.id ?? column.key} className="border-b border-separator px-3 py-2">
                      {typeof rowElement?.props.children === 'function'
                        ? rowElement.props.children(column.uid ?? column.id ?? column.key)
                        : rowElement?.props.children}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

type TableHeaderProps<T> = {
  columns?: T[];
  children?: React.ReactNode | ((item: T) => React.ReactNode);
};

type TableBodyProps<T> = {
  items?: T[];
  emptyContent?: React.ReactNode;
  children?: React.ReactNode | ((item: T) => React.ReactNode);
};

type TableRowProps<T = unknown> = {
  children?: React.ReactNode | ((columnKey: React.Key) => React.ReactNode);
  className?: string;
};

export function TableHeader<T extends object = object>(_props: TableHeaderProps<T>) {
  return null;
}
TableHeader.displayName = 'CompatTableHeader';

export function TableColumn({ children }: any) {
  return <>{children}</>;
}

export function TableBody<T extends object = object>(_props: TableBodyProps<T>) {
  return null;
}
TableBody.displayName = 'CompatTableBody';

export function TableRow<T = unknown>({ children }: TableRowProps<T>) {
  return <>{children}</>;
}

export function TableCell({ children }: any) {
  return <>{children}</>;
}
