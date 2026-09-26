export function AttributeList({ attributes }: { attributes: Record<string, string> }) {
  return (
    <dl className="attributes grid grid-cols-[minmax(100px,35%)_1fr] gap-x-4 gap-y-2 text-small">
      {Object.entries(attributes).map(([key, value]) => (
        <div className="contents" key={key}>
          <dt className="break-words text-secondary">{key}</dt>
          <dd className="m-0 min-w-0 break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
