import Lakbay from "@/components/lakbay";
import { permanentRedirect } from "next/navigation";
import { retiredGuidesTarget, exploreRouteTitle } from "@/lib/explore";
type PageProps = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({ params, searchParams }: PageProps) {
  const route = await params,
    query = await searchParams;
  return {
    title: exploreRouteTitle(
      "/" + route.path.join("/"),
      Array.isArray(query.view) ? query.view[0] : query.view,
    ),
  };
}
export default async function Page({ params, searchParams }: PageProps) {
  const route = await params;
  const query = await searchParams;
  const view = Array.isArray(query.view) ? query.view[0] : query.view;
  if (
    route.path.length === 1 &&
    (route.path[0] === "templates" ||
      (route.path[0] === "explore" && view === "advice"))
  )
    permanentRedirect(retiredGuidesTarget(query));
  return <Lakbay />;
}
