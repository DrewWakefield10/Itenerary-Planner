import {
  sourceLabel,
  sourceReviewNote,
  type SourceMetadata,
  type SourcedLink,
} from "@/lib/sources";

export function SourceIndicator({
  source,
  label,
}: {
  source: SourceMetadata;
  label?: string;
}) {
  const text = sourceLabel(source);
  const title = [
    label,
    source.sourceName,
    source.dateChecked ? `Reviewed ${source.dateChecked}` : null,
    sourceReviewNote,
  ]
    .filter(Boolean)
    .join(" · ");
  return source.sourceUrl ? (
    <a
      className={`source-indicator source-${source.status}`}
      href={source.sourceUrl}
      target="_blank"
      rel="noreferrer"
      title={title}
      aria-label={`${label ? label + ": " : ""}${text} — ${source.sourceName || "supporting source"}`}
    >
      {text}
      <span aria-hidden="true"> ↗</span>
    </a>
  ) : (
    <span className={`source-indicator source-${source.status}`} title={title}>
      {text}
    </span>
  );
}
export function SourceReviewNote() {
  return <p className="source-review-note">{sourceReviewNote}</p>;
}
export function AdvisorySources({
  links,
  note = "Only the official page link was checked. Open it for current bulletins; this is not a live advisory or a safety assessment.",
}: {
  links: SourcedLink[];
  note?: string;
}) {
  return (
    <div className="advisory-sources">
      {links.map((link) => (
        <div key={link.source.sourceUrl || link.label}>
          <a
            href={link.source.sourceUrl || undefined}
            target="_blank"
            rel="noreferrer"
          >
            {link.label} ↗
          </a>
          <SourceIndicator source={link.source} label="Official source link" />
        </div>
      ))}
      {links.length > 0 && <p>{note}</p>}
    </div>
  );
}
