// Prism 0.1.4 ships JavaScript without declarations. This typed boundary covers
// only the verified public primitives used here; Matrix retains its native types.
declare module '@mickyballadelli/prism' {
  import type { ComponentResult, Reactive, Signal, StyleDefinition } from '@mickyballadelli/matrix';
  type Value<T> = T | Reactive<T>;
  interface ButtonProps {
    label?: Value<string>;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary';
    size?: 'small' | 'medium' | 'large';
    loading?: Value<boolean>;
    loadingLabel?: string;
    disabled?: Value<boolean>;
    onClick?: (event: MouseEvent) => void;
    ariaLabel?: string;
    class?: string;
  }
  export function ButtonComponent(props: ButtonProps): ComponentResult;
  export function TextFieldComponent(props: {
    id?: string;
    name?: string;
    value?: Signal<string>;
    placeholder?: string;
    disabled?: Value<boolean>;
    required?: boolean;
    maxLength?: number;
    ariaDescribedBy?: string;
    ariaInvalid?: Value<boolean>;
    autocomplete?: string;
  }): ComponentResult;
  export function SpinnerComponent(props?: { ariaLabel?: string; size?: string }): ComponentResult;
  export const prismTheme: StyleDefinition;
}
