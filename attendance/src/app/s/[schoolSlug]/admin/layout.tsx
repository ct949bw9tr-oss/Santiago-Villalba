// Admin navigation lives in the app shell (sidebar); every admin page and
// action checks the role itself.
export default function AdminLayout({ children }: LayoutProps<"/s/[schoolSlug]/admin">) {
  return children;
}
