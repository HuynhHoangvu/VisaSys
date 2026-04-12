import { Facehash, type FacehashProps } from "facehash";

const COLOR_PALETTES = [
  ["#264653", "#2a9d8f", "#e9c46a"],
  ["#e9c46c", "#f4a261", "#2a9d8f"],
  ["#8ecae6", "#219ebc", "#023047"],
  ["#ffb703", "#fb8500", "#023047"],
  ["#6a994e", "#a7c957", "#f2cc8f"],
  ["#d62828", "#f77f00", "#fcbf49"],
  ["#8338ec", "#3a86ff", "#ff006e"],
];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

function getPalette(name: string) {
  const index = Math.abs(hashString(name || "user")) % COLOR_PALETTES.length;
  return COLOR_PALETTES[index];
}

export interface FaceAvatarProps extends Omit<FacehashProps, "name"> {
  name: string;
  className?: string;
}

export function FaceAvatar({
  name,
  size = 40,
  className,
  showInitial = true,
  variant = "gradient",
  intensity3d = "subtle",
  colors,
  style,
  ...props
}: FaceAvatarProps) {
  return (
    <Facehash
      name={name || "user"}
      size={size}
      className={className}
      showInitial={showInitial}
      variant={variant}
      intensity3d={intensity3d}
      colors={colors ?? getPalette(name)}
      style={{ color: "#ffffff", ...style }}
      {...props}
    />
  );
}
