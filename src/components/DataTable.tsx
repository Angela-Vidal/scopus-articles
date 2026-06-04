import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Search,
} from "lucide-react";
import React, {
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "../lib/utils";

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => ReactNode);
  sortableKey?: keyof T | string; // Use this key for sorting if accessor is a function
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  itemsPerPage?: number;
  rowActions?: (item: T) => ReactNode;

  serverSide?: boolean;
  totalCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (term: string) => void;
  onSortChange?: (col: string | null, desc: boolean) => void;
}

export function DataTable<T extends { id: any }>({
  columns,
  data,
  onRowClick,
  isLoading,
  emptyMessage = "Nenhum dado encontrado.",
  searchable = true,
  searchPlaceholder = "Buscar...",
  itemsPerPage = 25,
  rowActions,
  serverSide = false,
  totalCount = 0,
  currentPage: externalCurrentPage = 1,
  onPageChange,
  onSearch,
  onSortChange,
}: TableProps<T>) {
  const [internalSearchTerm, setInternalSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);

  const currentPage = serverSide ? externalCurrentPage : internalCurrentPage;

  // Handle Search Input
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (serverSide && onSearch) {
        onSearch(searchInput);
      } else {
        setInternalSearchTerm(searchInput);
      }
      if (!serverSide) setInternalCurrentPage(1);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (val.length === 0) {
      if (serverSide && onSearch) {
        onSearch("");
      } else {
        setInternalSearchTerm("");
      }
      if (!serverSide) setInternalCurrentPage(1);
    }
  };

  // Handle Search
  const filteredData = useMemo(() => {
    if (serverSide) return data;
    if (!internalSearchTerm) return data;
    const lowerSearch = internalSearchTerm.toLowerCase();
    return data.filter((item) => {
      // Very simple global search over all values
      return Object.values(item).some((val) =>
        String(val).toLowerCase().includes(lowerSearch),
      );
    });
  }, [data, internalSearchTerm, serverSide]);

  // Handle Sort
  const sortedData = useMemo(() => {
    if (serverSide) return filteredData;
    if (!sortCol) return filteredData;

    return [...filteredData].sort((a: any, b: any) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      // Check if they are numbers
      const aNum = Number(aVal);
      const bNum = Number(bVal);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDesc ? bNum - aNum : aNum - bNum;
      }

      const cmp = aStr < bStr ? -1 : 1;
      return sortDesc ? -cmp : cmp;
    });
  }, [filteredData, sortCol, sortDesc]);

  // Handle Pagination
  const calculatedTotalPages = serverSide
    ? Math.ceil(totalCount / itemsPerPage)
    : Math.ceil(sortedData.length / itemsPerPage);
  const totalPages = calculatedTotalPages > 0 ? calculatedTotalPages : 1;
  const paginatedData = useMemo(() => {
    if (serverSide) return sortedData;
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage, serverSide]);

  const handleSort = (col: Column<T>) => {
    const key = (col.sortableKey ||
      (typeof col.accessor === "string" ? col.accessor : null)) as string;
    if (!key) return;

    let newSortCol = sortCol;
    let newSortDesc = sortDesc;

    if (sortCol === key) {
      if (sortDesc) {
        newSortCol = null;
        newSortDesc = false;
      } else {
        newSortDesc = true;
      }
    } else {
      newSortCol = key;
      newSortDesc = false;
    }

    setSortCol(newSortCol);
    setSortDesc(newSortDesc);

    if (serverSide && onSortChange) {
      onSortChange(newSortCol, newSortDesc);
    }
  };

  // Reset page to 1 when search changes
  useEffect(() => {
    if (!serverSide) setInternalCurrentPage(1);
  }, [internalSearchTerm, serverSide]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      if (serverSide && onPageChange) {
        onPageChange(page);
      } else {
        setInternalCurrentPage(page);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {searchable && (
        <div className="relative max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-zinc-200 rounded-lg leading-5 bg-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-all"
            placeholder={searchPlaceholder}
            value={searchInput}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex flex-col">
        <div className="overflow-auto max-h-[65vh] xl:max-h-[calc(100vh-260px)] rounded-t-xl">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {columns.map((col, idx) => {
                  const key = (col.sortableKey ||
                    (typeof col.accessor === "string"
                      ? col.accessor
                      : null)) as string;
                  const isSortable = !!key;
                  const isSorted = sortCol === key;

                  return (
                    <th
                      key={idx}
                      onClick={() => isSortable && handleSort(col)}
                      className={cn(
                        "px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider select-none bg-zinc-50 shadow-[0_1px_0_0_#e4e4e7]",
                        isSortable && "cursor-pointer hover:bg-zinc-100",
                        col.className,
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {col.header}
                        {isSortable && (
                          <div className="flex flex-col text-zinc-300">
                            <ChevronUp
                              className={cn(
                                "w-3 h-3 -mb-1 text-zinc-300",
                                isSorted && !sortDesc && "text-emerald-600",
                              )}
                            />
                            <ChevronDown
                              className={cn(
                                "w-3 h-3",
                                isSorted && sortDesc && "text-emerald-600",
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
                {rowActions && (
                  <th className="px-6 py-4 w-12 bg-zinc-50 shadow-[0_1px_0_0_#e4e4e7]" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "group transition-colors duration-150",
                      onRowClick ? "cursor-pointer hover:bg-emerald-50/50" : "",
                    )}
                  >
                    {columns.map((col, idx) => (
                      <td
                        key={idx}
                        className={cn(
                          "px-6 py-4 text-sm text-zinc-600 transition-colors group-hover:text-emerald-950",
                          col.className,
                        )}
                      >
                        {typeof col.accessor === "function"
                          ? col.accessor(item)
                          : (item[col.accessor] as ReactNode)}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {rowActions(item)}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-12 text-center text-sm text-zinc-400 font-medium"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Mostrando{" "}
              <span className="font-medium">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{" "}
              até{" "}
              <span className="font-medium">
                {Math.min(
                  currentPage * itemsPerPage,
                  serverSide ? totalCount : sortedData.length,
                )}
              </span>{" "}
              de{" "}
              <span className="font-medium">
                {serverSide ? totalCount : sortedData.length}
              </span>{" "}
              resultados
            </span>

            <div className="flex gap-2">
              <button
                onClick={() => goToPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-600"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
