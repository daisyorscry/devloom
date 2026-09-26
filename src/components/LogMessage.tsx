import { memo } from 'react';
import { logTokens, type LogTone, type LogToken } from '../logPresentation';
const tokenColors: Record<NonNullable<LogToken['tone']>, string> = {
  output: 'text-console-text',
  system: 'text-console-muted',
  info: 'text-log-info',
  method: 'text-log-info',
  success: 'text-log-success',
  warn: 'text-log-warn',
  duration: 'text-log-warn',
  error: 'text-log-error',
  debug: 'text-log-debug',
  path: 'text-log-path',
};
export const LogMessage = memo(function LogMessage({
  message,
  tone = 'output',
}: {
  message: string;
  tone?: LogTone;
}) {
  return (
    <span className={`log-message min-w-0 break-words whitespace-pre-wrap ${tokenColors[tone]}`}>
      {logTokens(message).map((token, index) =>
        token.tone ? (
          <span
            key={index}
            className={`log-token token-${token.tone} font-medium ${tokenColors[token.tone]}`}
          >
            {token.text}
          </span>
        ) : (
          token.text
        ),
      )}
    </span>
  );
});
