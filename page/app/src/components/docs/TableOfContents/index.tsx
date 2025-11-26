import React, { useEffect, useState } from 'react';
import type { TableOfContentsProps, Heading } from './types';
import { OBSERVER_OPTIONS } from './constants';

function HeadingLink({ heading, activeId }: { heading: Heading; activeId: string }) {
  const isActive = activeId === heading.slug;
  const baseClass = 'block py-1 text-sm transition font-outfit';
  const activeClass = 'text-primary font-medium';
  const inactiveClass = 'text-base-content/70 hover:text-primary';

  return (
    <li>
      <a
        href={`#${heading.slug}`}
        className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
      >
        {heading.text}
      </a>
      {heading.subheadings && heading.subheadings.length > 0 && (
        <ul className="ml-4">
          {heading.subheadings.map((subheading) => (
            <HeadingLink key={subheading.slug} heading={subheading} activeId={activeId} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    }, OBSERVER_OPTIONS);

    const headingElements = document.querySelectorAll('h2[id], h3[id], h4[id]');
    headingElements.forEach((element) => observer.observe(element));

    return () => {
      headingElements.forEach((element) => observer.unobserve(element));
    };
  }, []);

  return (
    <div className="hidden xl:sticky xl:block xl:top-28">
      <h2 className="mb-4 text-lg font-bold font-outfit">On this page</h2>
      <ul className="space-y-1">
        {headings.map((heading) => (
          <HeadingLink key={heading.slug} heading={heading} activeId={activeId} />
        ))}
      </ul>
    </div>
  );
}
