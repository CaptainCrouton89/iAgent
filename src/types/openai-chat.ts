export interface MemorySearchParameters {
  query?: string;
  threshold?: number;
  limit?: number;
  searchMode?: "deep" | "shallow";
  memoryType?: "episodic" | "semantic" | "hybrid";
  semanticType?: "fact" | "theme" | "summary";
  page?: number;
  startDate?: string;
  endDate?: string;
}

export interface MemoryInspectParameters {
  memoryId: string;
  startIndex?: number;
  endIndex?: number;
}
