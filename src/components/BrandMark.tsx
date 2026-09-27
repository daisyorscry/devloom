export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <img
      className="shrink-0"
      src="/brand/devloom-mark.svg"
      width={small ? 20 : 28}
      height={small ? 20 : 28}
      alt=""
      aria-hidden="true"
    />
  );
}
