export function titleSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug.slice(0, 80) : "session";
}

export function reportDateSlug(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function pdfDownloadFilename(title: string, date: Date): string {
  return `dryrun-${titleSlug(title)}-${reportDateSlug(date)}.pdf`;
}

export function zipDownloadFilename(title: string, date: Date): string {
  return `dryrun-bundle-${titleSlug(title)}-${reportDateSlug(date)}.zip`;
}
