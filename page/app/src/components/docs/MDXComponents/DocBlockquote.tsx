import { Children, cloneElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert.tsx";

const info = { label: "Info", Icon: Info, color: "border-info bg-info/10" };
const alert = { label: "Alert", Icon: CircleAlert, color: "border-error bg-error/10" };
const warning = { label: "Warning", Icon: TriangleAlert, color: "border-warning bg-warning/15" };
const kinds = new Map([
  ["NOTE", info], ["INFO", info], ["IMPORTANT", alert], ["ALERT", alert], ["WARNING", warning],
]);

function readCallout(children: ReactNode) {
  const blocks = Children.toArray(children);
  const first = blocks.find(isValidElement);
  if (!isValidElement<{ children?: ReactNode }>(first)) return;
  if (first.type !== "p") return;
  const [leading, ...inline] = Children.toArray(first.props.children);
  if (typeof leading !== "string") return;
  const marker = /^\[!(\w+)\][ \t]*(?:\r?\n|$)/.exec(leading);
  if (!marker) return;
  const kind = kinds.get(marker[1]);
  if (!kind) return;
  const rest = leading.slice(marker[0].length);
  const hasText = rest || inline.length;
  const paragraph = hasText ? cloneElement(first, {}, rest, ...inline) : null;
  const body = blocks.map((block) => block === first ? paragraph : block);
  return { ...kind, body };
}

export function DocBlockquote({ children, ...props }: ComponentProps<"blockquote">) {
  const callout = readCallout(children);
  if (!callout) return <blockquote {...props}>{children}</blockquote>;
  const { Icon, label, color, body } = callout;
  return (
    <Alert role="note" aria-label={label} className={`my-4 rounded-md px-4 py-3 text-foreground ${color}`}>
      <Icon aria-hidden="true" />
      <AlertTitle>{label}</AlertTitle>
      <AlertDescription className="text-base leading-relaxed text-foreground [&>p]:my-0">
        {body}
      </AlertDescription>
    </Alert>
  );
}
