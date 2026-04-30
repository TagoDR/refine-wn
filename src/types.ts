export interface LogEntry {
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: string;
}
