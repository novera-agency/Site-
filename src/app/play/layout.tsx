import { Shell } from "@/components/Shell";
import { CloudSync } from "@/components/CloudSync";
export default function PlayLayout({ children }: { children: React.ReactNode }) { return <Shell><CloudSync />{children}</Shell>; }
