import { Hero } from "@/components/home/Hero";
import { CodeBlock } from "@/components/home/CodeBlock";
import Features from "@/components/home/Features";
import { Integration } from "@/components/home/Integration";
import { Install } from "@/components/home/Install";

export function HomePage() {
  return (
    <div className="px-3 md:px-10 xl:px-28">
      <Hero />
      <CodeBlock />
      <Features />
      <Integration />
      <Install />
    </div>
  );
}
