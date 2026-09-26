import { FEATURES } from "./constants";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

export default function Features() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 justify-items-center py-20 lg:py-28">
      {FEATURES.map((feature) => {
        const Icon = feature.icon;
        return (
          <Card
            key={feature.title}
            className="max-w-2xl rounded-lg border border-foreground/10 bg-muted py-0 transition hover:shadow-lg"
          >
            <CardContent className="grid gap-4 p-6 font-sans">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
                <Icon className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-lg font-bold">
                {feature.title}
              </CardTitle>
              <p>{feature.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
