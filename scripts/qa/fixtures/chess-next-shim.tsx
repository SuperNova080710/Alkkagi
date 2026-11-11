import type { ReactNode } from 'react';
export default function Link({href, children, ...props}: {href: string; children?: ReactNode}) {
  return <a href={href} {...props}>{children}</a>;
}
const router = {
  push(path: string) {document.documentElement.dataset.qaNavigation=path;},
  replace(path: string) {document.documentElement.dataset.qaNavigation=path;},
};
export const useRouter = () => router;
