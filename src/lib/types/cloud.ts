export type CloudWord = [string, number];

export type ColorScheme = 'mono' | 'random' | 'custom';

export type ServerMsg =
  | { type: 'snapshot'; questionId: string; words: CloudWord[] }
  | { type: 'closed'; reason: 'expired' | 'sent' };

export type ClientMsg = { type: 'ping' };
