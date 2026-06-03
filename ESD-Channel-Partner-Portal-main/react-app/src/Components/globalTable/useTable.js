import { useState,  } from "react";

export default function useTable(data, initialPageSize, totalRecords = null) {
  // 1. Create state for pageSize (initialized by the argument)
  const [pageSize, setPageSizeState] = useState(initialPageSize || 10);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // const sortedData = useMemo(() => {
  //   if (!sortConfig.key) return data;

  //   return [...data].sort((a, b) => {
  //     const v1 = a[sortConfig.key];
  //     const v2 = b[sortConfig.key];
  //     if (v1 === v2) return 0;
  //     if (sortConfig.direction === "asc") return v1 > v2 ? 1 : -1;
  //     return v1 < v2 ? 1 : -1;
  //   });
  // }, [data, sortConfig]);

  // 2. Use the local pageSize state for calculations
  const total = totalRecords || data.length;
const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageData = data;

  const setSort = (key) => {
    setPage(1);
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // 3. Create a wrapper function to change size and reset page
  const setPageSize = (size) => {
    setPageSizeState(size);
    setPage(1); // Important: go back to page 1
  };

  const nextPage = () => setPage((p) => Math.min(totalPages, p + 1));
  const prevPage = () => setPage((p) => Math.max(1, p - 1));

  // 4. Return everything back to the component
  return { 
    pageData, 
    page, 
    totalPages, 
    sortConfig, 
    setSort, 
    nextPage, 
    prevPage, 
    pageSize, // Return the current size
    setPageSize // Return the function to change it
  };
}