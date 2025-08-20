export interface SearchResult {
  title: string;
  description: string;
  content: string;
  slug: string;
}

// This will be populated with actual documentation data
export const searchData: SearchResult[] = [
  {
    title: "Introduction",
    description: "Get started with Codependence",
    content:
      "Codependence is a powerful JavaScript utility for managing and validating critical dependencies across your projects.",
    slug: "introduction",
  },
  {
    title: "CLI Usage",
    description: "Learn how to use the Codependence CLI",
    content:
      "The Codependence CLI provides powerful commands for managing your dependencies.",
    slug: "cli",
  },
  {
    title: "Options",
    description: "Configuration options for Codependence",
    content:
      "Customize Codependence behavior with various configuration options.",
    slug: "options",
  },
  {
    title: "Node.js API",
    description: "Using Codependence programmatically",
    content: "Integrate Codependence into your Node.js applications.",
    slug: "node",
  },
  {
    title: "Recipes",
    description: "Common use cases and examples",
    content: "Practical examples and common patterns for using Codependence.",
    slug: "recipes",
  },
  {
    title: "Main Usecase",
    description: "Primary use cases for Codependence",
    content: "Understanding when and how to use Codependence effectively.",
    slug: "main-usecase",
  },
  {
    title: "Why Use Codependence",
    description: "Benefits of using Codependence",
    content: "Learn why Codependence is essential for dependency management.",
    slug: "why-use-codependence",
  },
  {
    title: "Why Not Use Codependence",
    description: "When Codependence might not be the right tool",
    content: "Understanding the limitations and when to consider alternatives.",
    slug: "why-not-use-codependence",
  },
  {
    title: "Badges",
    description: "Display Codependence status badges",
    content:
      "Add status badges to your README to show Codependence compliance.",
    slug: "badges",
  },
  {
    title: "Footer",
    description: "Footer configuration and customization",
    content: "Customize the footer of your Codependence reports.",
    slug: "footer",
  },
  {
    title: "Synopsis",
    description: "Quick overview of Codependence",
    content: "A brief summary of what Codependence does and how it works.",
    slug: "synopsis",
  },
  {
    title: "Usage",
    description: "Detailed usage instructions",
    content: "Comprehensive guide to using Codependence in your projects.",
    slug: "usage",
  },
];
