import { FEATURES } from "./constants";

export default function Features() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 justify-items-center py-20 lg:py-28">
      {FEATURES.map((feature) => {
        const Icon = feature.icon;
        return (
          <div
            key={feature.title}
            className="card max-w-2xl bg-base-200 border border-base-content/10 hover:shadow-lg transition rounded-lg"
          >
            <div className="card-body font-sans">
              <div className="h-16 w-16 bg-base-300 rounded-full flex items-center justify-center">
                <Icon className="w-8 h-8 text-primary" />
              </div>
              <h2 className="card-title">{feature.title}</h2>
              <p>{feature.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
