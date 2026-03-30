import React, { createContext, useContext } from 'react';

interface PageContextType {
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const PageContext = createContext<PageContextType | null>(null);

export function PageProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: PageContextType;
}) {
  return <PageContext.Provider value={value}>{children}</PageContext.Provider>;
}

export function usePage() {
  const ctx = useContext(PageContext);
  if (!ctx) return null;
  return ctx;
}
