import type { ReactNode } from 'react';
export default function Link({href, children, ...props}: {href: string; children?: ReactNode}) {
  return <a href={href} {...props}>{children}</a>;
}
const router = {push() {}, replace() {}};
export const useRouter = () => router;
