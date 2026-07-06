import type { ComponentChildren } from 'preact';
import { formatScore } from '../../domain/ratings';
import type { PlaceStatus } from '../../domain/places';

const statusLabels: Record<PlaceStatus, string> = {
  visited: 'Visited',
  'want-to-visit': 'Want to visit',
  unavailable: 'Unavailable',
};

export function StatusChip({ status }: { status: PlaceStatus }) {
  return <span class={`status-chip status-chip--${status}`}>{statusLabels[status]}</span>;
}

export function ScoreBadge({ score, large = false }: { score: number | null; large?: boolean }) {
  const classes = ['score-badge', score === null ? 'score-badge--empty' : '', large ? 'score-badge--large' : ''].filter(Boolean).join(' ');
  return <div class={classes}>
    <strong>{formatScore(score)}</strong>
    <span>{score === null ? 'Add a visit to rank it' : 'Overall · out of 10'}</span>
  </div>;
}

export function LoadState({ children }: { children: ComponentChildren }) {
  return <main class="shell app-state" aria-live="polite">{children}</main>;
}
