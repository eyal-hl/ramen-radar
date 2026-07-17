import { useEffect, useRef } from 'preact/hooks';
import {
  directoryViewUrl,
  manageActionUrl,
  type DirectoryView,
} from '../../domain/urls';

interface MobilePrimaryNavProps {
  activeView: DirectoryView;
  base: string;
  onNavigate: (view: DirectoryView) => void;
  onQuickAdd: () => void;
}

const destinations: ReadonlyArray<{ view: DirectoryView; label: string }> = [
  { view: 'list', label: 'Radar' },
  { view: 'map', label: 'Map' },
  { view: 'journal', label: 'Journal' },
];

export function MobilePrimaryNav({ activeView, base, onNavigate, onQuickAdd }: MobilePrimaryNavProps) {
  return (
    <div class="mobile-primary-shell">
      <button class="mobile-quick-add" type="button" aria-haspopup="dialog" onClick={onQuickAdd}>
        <span aria-hidden="true">+</span> Quick add
      </button>
      <nav class="mobile-primary-nav" aria-label="Primary mobile navigation">
        {destinations.map(({ view, label }) => (
          <a
            class={activeView === view ? 'active' : ''}
            href={directoryViewUrl(base, view)}
            aria-current={activeView === view ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(view);
            }}
            key={view}
          >
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}

interface QuickAddSheetProps {
  base: string;
  onClose: () => void;
}

const quickActions = [
  { action: 'add-place', label: 'Save a place', description: 'Paste a Google Maps link' },
  { action: 'log-visit', label: 'Log a visit', description: 'Capture today\'s bowls and notes' },
  { action: 'add-review', label: 'Add a review', description: 'Rate an existing visit' },
] as const;

export function QuickAddSheet({ base, onClose }: QuickAddSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const inerted: HTMLElement[] = [];
    let activeBranch: HTMLElement | null = dialog?.parentElement ?? null;

    while (activeBranch && activeBranch !== document.body) {
      const parent = activeBranch.parentElement;
      if (!parent) break;
      for (const sibling of parent.children) {
        if (sibling === activeBranch || !(sibling instanceof HTMLElement) || sibling.hasAttribute('inert')) continue;
        sibling.setAttribute('inert', '');
        inerted.push(sibling);
      }
      activeBranch = parent;
    }

    const focusableControls = () => dialog
      ? [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      : [];
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusableControls();
      if (controls.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (dialog && !dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onDocumentKeyDown, true);
    dialog?.focus();
    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown, true);
      document.body.style.overflow = previousOverflow;
      for (const element of inerted) element.removeAttribute('inert');
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div class="quick-add-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        class="quick-add-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        tabIndex={-1}
      >
        <header class="quick-add-sheet__header">
          <div>
            <p class="eyebrow">Quick capture</p>
            <h2 id="quick-add-title">What are you logging?</h2>
          </div>
          <button type="button" class="quick-add-sheet__close" onClick={onClose} aria-label="Close quick add">Close</button>
        </header>
        <nav class="quick-add-actions" aria-label="Quick add actions">
          {quickActions.map(({ action, label, description }) => (
            <a href={manageActionUrl(base, action)} key={action}>
              <span><strong>{label}</strong><small>{description}</small></span>
              <span aria-hidden="true">→</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

interface PlaceActionDockProps {
  base: string;
  placeId: string;
  mapUrl: string;
  menuUrl?: string;
}

export function PlaceActionDock({ base, placeId, mapUrl, menuUrl }: PlaceActionDockProps) {
  return (
    <nav class="place-action-dock" aria-label="Place actions">
      <a href={mapUrl}>Directions</a>
      {menuUrl && <a href={menuUrl}>Menu</a>}
      <a class="primary" href={manageActionUrl(base, 'log-visit', placeId)}>Log visit</a>
      <a href={manageActionUrl(base, 'edit-place', placeId)}>Edit</a>
    </nav>
  );
}
