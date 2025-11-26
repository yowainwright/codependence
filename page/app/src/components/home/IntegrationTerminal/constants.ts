import type { AnimationStep } from './types';

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const TYPING_SPEED_MS = 15;
export const SPINNER_FRAME_MS = 80;
export const LOOP_DELAY_MS = 3000;

export const ANIMATION_STEPS: AnimationStep[] = [
  {
    type: 'type',
    lines: [
      { text: '$ ', color: 'text-secondary' },
      { text: 'codependence --update', color: 'text-base-content' },
    ],
  },
  { type: 'pause', duration: 300 },
  { type: 'spinner', duration: 2000, text: 'codependence wrestling...' },
  {
    type: 'type',
    lines: [
      { text: '\n\n', color: '' },
      { text: '↑', color: 'text-info' },
      { text: ' eslint ', color: 'text-base-content' },
      { text: '8.56.0', color: 'text-warning' },
      { text: ' → ', color: 'text-base-content/50' },
      { text: '9.15.0', color: 'text-success' },
    ],
  },
  { type: 'pause', duration: 150 },
  {
    type: 'type',
    lines: [
      { text: '\n', color: '' },
      { text: '↑', color: 'text-info' },
      { text: ' prettier ', color: 'text-base-content' },
      { text: '3.1.0', color: 'text-warning' },
      { text: ' → ', color: 'text-base-content/50' },
      { text: '3.4.2', color: 'text-success' },
    ],
  },
  { type: 'pause', duration: 150 },
  {
    type: 'type',
    lines: [
      { text: '\n', color: '' },
      { text: '↑', color: 'text-info' },
      { text: ' @types/node ', color: 'text-base-content' },
      { text: '20.9.0', color: 'text-warning' },
      { text: ' → ', color: 'text-base-content/50' },
      { text: '22.9.0', color: 'text-success' },
    ],
  },
  { type: 'pause', duration: 150 },
  {
    type: 'type',
    lines: [
      { text: '\n', color: '' },
      { text: '=', color: 'text-base-content/50' },
      { text: ' react ', color: 'text-base-content' },
      { text: '18.3.1', color: 'text-base-content/70' },
      { text: ' (pinned)', color: 'text-base-content/50' },
    ],
  },
  { type: 'pause', duration: 300 },
  {
    type: 'type',
    lines: [
      { text: '\n\n', color: '' },
      { text: '✔', color: 'text-success' },
      { text: ' codependence pinned!', color: 'text-base-content' },
    ],
  },
];
