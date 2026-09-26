// Parse command arguments without invoking a shell; quoted paths remain one argument.
export function parseArgs(value: string): string[] {
  const result: string[] = [];
  let word = '',
    quote = '',
    escaped = false,
    active = false;
  for (const char of value) {
    if (escaped) {
      word += char;
      escaped = false;
      active = true;
    } else if (char === '\\' && quote !== "'") {
      escaped = true;
      active = true;
    } else if (quote) {
      if (char === quote) quote = '';
      else word += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      active = true;
    } else if (/\s/.test(char)) {
      if (active) {
        result.push(word);
        word = '';
        active = false;
      }
    } else {
      word += char;
      active = true;
    }
  }
  if (escaped || quote) throw new Error('Close all quotes and escapes in arguments.');
  if (active) result.push(word);
  return result;
}
export const formatArgs = (args: string[]) =>
  args.map((arg) => (/^[a-zA-Z0-9_./:@=+-]+$/.test(arg) ? arg : JSON.stringify(arg))).join(' ');
