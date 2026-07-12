import { stdout } from 'node:process';
import { isatty } from 'node:tty';
import { env } from 'node:process';

const HAS_COLOR = !env.NO_COLOR && isatty(1);

const COLORS = {
  reset:   '\x1b[0m',
  info:    '\x1b[36m', // cyan
  muted:   '\x1b[90m', // gray
} as const;

export class ProgressBar {
  private readonly total: number;
  private current: number = 0;
  private readonly width: number;
  private readonly text: string;
  private active: boolean = false;
  private startTime: number = 0;

  constructor(text: string, total: number, width: number = 40) {
    this.text = text;
    this.total = total;
    this.width = width;
  }

  start(): void {
    if (!HAS_COLOR) return;
    this.active = true;
    this.current = 0;
    this.startTime = Date.now();
    this.render();
  }

  update(current: number): void {
    if (!this.active || !HAS_COLOR) return;
    this.current = Math.min(current, this.total);
    this.render();
  }

  stop(): void {
    if (!this.active || !HAS_COLOR) return;
    this.active = false;
    this.current = this.total;
    this.render();
    stdout.write('\n');
  }

  private render(): void {
    const percent = this.total === 0 ? 100 : Math.floor((this.current / this.total) * 100);
    const filledChars = this.total === 0 ? this.width : Math.floor((this.current / this.total) * this.width);
    const emptyChars = this.width - filledChars;

    const filledStr = '▓'.repeat(filledChars);
    const emptyStr = '░'.repeat(emptyChars);
    
    // Calculate speed
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    let speedStr = '';
    if (elapsedSeconds > 0 && this.current > 0) {
      const bytesPerSec = this.current / elapsedSeconds;
      if (bytesPerSec > 1024 * 1024) {
        speedStr = ` ${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
      } else if (bytesPerSec > 1024) {
        speedStr = ` ${(bytesPerSec / 1024).toFixed(1)} KB/s`;
      } else {
        speedStr = ` ${Math.floor(bytesPerSec)} B/s`;
      }
    }

    const bar = `[${COLORS.info}${filledStr}${COLORS.reset}${COLORS.muted}${emptyStr}${COLORS.reset}]`;
    const line = `\r${this.text}  ${bar} ${percent}%${speedStr}`;
    
    // Clear line and write
    stdout.write('\x1b[2K' + line);
  }
}
