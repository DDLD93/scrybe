type FileMetadataRowProps = {
  label: string;
  value: string;
};

export function FileMetadataRow({ label, value }: FileMetadataRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
