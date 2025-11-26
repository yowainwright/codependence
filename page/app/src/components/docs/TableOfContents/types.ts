export type Heading = {
  depth: number;
  slug: string;
  text: string;
  subheadings?: Heading[];
};

export type TableOfContentsProps = {
  headings: Heading[];
};
