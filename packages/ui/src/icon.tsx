import { ICON_PATHS, type IconName } from './icon-paths.ts';

export interface IconProps {
  name: IconName;
  className?: string;
  /** Texto para lectores de pantalla. Sin él, el ícono es decorativo y se oculta (PF-045). */
  label?: string;
}

/** Ícono Material Symbols como SVG en línea: hereda el color del texto y escala con el tamaño de fuente. */
export function Icon({ name, className, label }: IconProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg
      viewBox="0 -960 960 960"
      width="1em"
      height="1em"
      fill="currentColor"
      focusable="false"
      className={className}
      {...a11y}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
