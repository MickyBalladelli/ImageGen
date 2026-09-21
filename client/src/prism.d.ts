// Narrow declarations for the public APIs used from Prism's JavaScript package.
declare module '@mickyballadelli/prism' {
  import type { ComponentResult, Reactive, Signal, StyleDefinition, TemplateResult } from '@mickyballadelli/matrix';
  type Value<T> = T | Reactive<T>;
  interface ButtonProps {
    label?: Value<string>;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'tertiary';
    size?: 'small' | 'medium' | 'large';
    loading?: Value<boolean>;
    loadingLabel?: string;
    disabled?: Value<boolean>;
    pressed?: Value<boolean>;
    onClick?: (event: MouseEvent) => void;
    ariaLabel?: string;
    title?: string;
    icon?: unknown;
    showLabel?: boolean;
    fullWidth?: boolean;
    class?: string;
  }
  export function ButtonComponent(props: ButtonProps): ComponentResult;
  export function TextFieldComponent(props: {
    id?: string; name?: string; value?: Signal<string>; placeholder?: string;
    disabled?: Value<boolean>; required?: boolean; maxLength?: number;
    ariaDescribedBy?: string; ariaInvalid?: Value<boolean>; autocomplete?: string;
    type?: string; inputMode?: string; class?: string;
  }): ComponentResult;
  export function SelectComponent(props: {
    id?: string; name?: string; value?: Signal<string>; disabled?: Value<boolean>;
    options: { value: string; label: string }[]; ariaLabel?: string; size?: string;
  }): ComponentResult;
  export function CheckBoxComponent(props: {
    id?: string; checked?: Signal<boolean>; disabled?: Value<boolean>;
    children?: unknown; ariaLabel?: string; class?: string;
  }): ComponentResult;
  export function BackgroundComponent(props: {
    animation?: string; palette?: string; animated?: Value<boolean>; class?: string;
    children?: unknown; ariaLabel?: string; speed?: number; intensity?: number;
    grain?: number; overlayOpacity?: number; height?: string; minHeight?: string;
    padding?: string; radius?: string; baseColor?: string; accentColor?: string; glowColor?: string;
  }): ComponentResult;
  export function SpinnerComponent(props?: { ariaLabel?: string; size?: string }): ComponentResult;
  export function SparkIcon(props?: object): TemplateResult;
  export function CopyIcon(props?: object): TemplateResult;
  export function DownloadIcon(props?: object): TemplateResult;
  export function SettingsIcon(props?: object): TemplateResult;
  export function ImageIcon(props?: object): TemplateResult;
  export function TerminalIcon(props?: object): TemplateResult;
  export function CloseIcon(props?: object): TemplateResult;
  export const prismTheme: StyleDefinition;
}
