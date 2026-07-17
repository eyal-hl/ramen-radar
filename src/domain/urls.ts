export type DirectoryView = 'list' | 'map' | 'journal';

export type ManageAction = 'add-place' | 'log-visit' | 'add-review' | 'edit-place';

export interface ManageIntent {
  action: ManageAction | null;
  placeId: string | null;
}

const manageActions = new Set<ManageAction>(['add-place', 'log-visit', 'add-review', 'edit-place']);

export function joinBase(base: string, path: string): string {
  const normalizedBase = base === '/' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`;
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
}

export function placeDetailUrl(base: string, placeId: string): string {
  return `${joinBase(base, 'place/')}?id=${encodeURIComponent(placeId)}`;
}

export function directoryViewUrl(base: string, view: DirectoryView): string {
  const directoryUrl = joinBase(base, '');
  return view === 'list' ? directoryUrl : `${directoryUrl}?view=${view}`;
}

export function manageActionUrl(base: string, action: ManageAction, placeId?: string): string {
  const manageUrl = joinBase(base, 'manage/');
  const place = placeId ? `&place=${encodeURIComponent(placeId)}` : '';
  return `${manageUrl}?action=${action}${place}`;
}

export function readManageIntent(search: string): ManageIntent {
  const params = new URLSearchParams(search);
  const action = params.get('action');
  return {
    action: action && manageActions.has(action as ManageAction) ? action as ManageAction : null,
    placeId: params.get('place') || null,
  };
}
