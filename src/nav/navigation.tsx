import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BackHandler } from 'react-native';
import type { GameId } from '../domain/games';

/**
 * A deliberately small typed stack navigator.
 *
 * Khil has nine screens and one hard requirement the child flow imposes: while
 * a session is running, hardware back must not silently drop the child into a
 * parent screen mid-round. Owning the stack makes that a two-line guard instead
 * of a fight with a navigation library's lifecycle.
 */

export type RouteMap = {
  /** Account creation: PIN, specialist match, consent. Once per household. */
  onboarding: undefined;
  /** "Who's playing?" — the gate every parent lands on. */
  profileGate: undefined;
  /** Create a child, or edit one. `childId` absent means create. */
  profileEditor: { childId?: string } | undefined;
  plans: undefined;

  parentHome: undefined;
  /** Choose a game and an age group, instead of taking the day's rotation. */
  gamePicker: undefined;
  /** `gameIds` absent means "use the rotation's pick". */
  sessionIntro: { gameIds?: GameId[] } | undefined;
  session: { gameIds?: GameId[] } | undefined;
  sessionComplete: { flagId?: string };

  flagDetail: { flagId: string };
  skills: undefined;
  clinicList: undefined;
  clinicReview: { flagId: string };
  devPanel: undefined;
};

export type RouteName = keyof RouteMap;

export type Route<K extends RouteName = RouteName> = {
  name: K;
  params: RouteMap[K];
};

type Nav = {
  stack: Route[];
  current: Route;
  push: <K extends RouteName>(name: K, params?: RouteMap[K]) => void;
  replace: <K extends RouteName>(name: K, params?: RouteMap[K]) => void;
  reset: <K extends RouteName>(name: K, params?: RouteMap[K]) => void;
  back: () => boolean;
  canGoBack: boolean;
  /** While true, hardware back is swallowed (a session is in progress). */
  setBackLocked: (locked: boolean) => void;
};

const NavContext = createContext<Nav | null>(null);

export function NavigationProvider({
  initial,
  children,
}: {
  initial: Route;
  children: React.ReactNode;
}) {
  const [stack, setStack] = useState<Route[]>([initial]);
  const [backLocked, setBackLocked] = useState(false);

  const push = useCallback(<K extends RouteName>(name: K, params?: RouteMap[K]) => {
    setStack(prev => [...prev, { name, params: params as RouteMap[K] } as Route]);
  }, []);

  const replace = useCallback(<K extends RouteName>(name: K, params?: RouteMap[K]) => {
    setStack(prev => [...prev.slice(0, -1), { name, params: params as RouteMap[K] } as Route]);
  }, []);

  const reset = useCallback(<K extends RouteName>(name: K, params?: RouteMap[K]) => {
    setStack([{ name, params: params as RouteMap[K] } as Route]);
  }, []);

  const back = useCallback(() => {
    let moved = false;
    setStack(prev => {
      if (prev.length <= 1) return prev;
      moved = true;
      return prev.slice(0, -1);
    });
    return moved;
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (backLocked) return true;
      if (stack.length <= 1) return false;
      setStack(prev => (prev.length <= 1 ? prev : prev.slice(0, -1)));
      return true;
    });
    return () => sub.remove();
  }, [backLocked, stack.length]);

  const value = useMemo<Nav>(
    () => ({
      stack,
      current: stack[stack.length - 1],
      push,
      replace,
      reset,
      back,
      canGoBack: stack.length > 1,
      setBackLocked,
    }),
    [stack, push, replace, reset, back],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used inside <NavigationProvider>');
  return ctx;
}

/** Typed params accessor for the active route. */
export function useParams<K extends RouteName>(): RouteMap[K] {
  const { current } = useNav();
  return current.params as RouteMap[K];
}
