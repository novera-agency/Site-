import { Shell } from "@/components/Shell";
import { CloudSync } from "@/components/CloudSync";
import { IntroGate } from "@/components/IntroGate";
export default function PlayLayout({ children }: { children: React.ReactNode }) { return <Shell><CloudSync /><IntroGate />{children}</Shell>; }
