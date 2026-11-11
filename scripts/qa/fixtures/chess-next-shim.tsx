import type { ReactNode } from 'react';
export default function Link({href, children, ...props}: {href: string; children?: ReactNode}) {
  return <a href={href} {...props}>{children}</a>;
}
const router = {
  push(path: string) {document.documentElement.dataset.qaNavigation=path;},
  replace(path: string) {
    const state=document.documentElement.dataset;
    state.qaNavigation=path;
    state.qaReplaceCount=String(Number(state.qaReplaceCount ?? 0)+1);
  },
};
export const useRouter = () => router;
