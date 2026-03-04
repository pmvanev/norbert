/**
 * Config Explorer API client -- fetches configuration tree data from the server.
 *
 * No @norbert/* runtime dependencies. Communicates via HTTP only.
 * Functions accept baseUrl to enable testing without real server.
 */

// ---------------------------------------------------------------------------
// Response types (dashboard's own types, mirroring server response shape)
// ---------------------------------------------------------------------------

export interface ConfigTreeNode {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly scopeColor: string;
  readonly subsystem: string;
  readonly nodeType: string;
  readonly parsedContent: {
    readonly format: string;
    readonly parsedData?: Record<string, unknown>;
    readonly keys?: readonly string[];
    readonly error?: string;
  } | null;
  readonly placeholder: boolean;
  readonly error: string | null;
}

// ---------------------------------------------------------------------------
// FileTree types (mirroring @norbert/config-explorer FileTree shape)
// ---------------------------------------------------------------------------

export interface ParsedContentResponse {
  readonly format: string;
  readonly parsedData?: Record<string, unknown>;
  readonly keys?: readonly string[];
  readonly frontmatter?: Record<string, unknown>;
  readonly body?: string;
  readonly frontmatterFields?: readonly { key: string; value: unknown; annotation: string }[];
  readonly error?: string;
}

export interface FileTreeNode {
  readonly name: string;
  readonly path: string;
  readonly scope: string;
  readonly subsystem: string | null;
  readonly type: 'file' | 'directory' | 'missing';
  readonly children: readonly FileTreeNode[];
  readonly node: {
    readonly id: string;
    readonly name: string;
    readonly scope: string;
    readonly subsystem: string;
    readonly nodeType: string;
    readonly filePath: string;
    readonly content: string;
    readonly parsedContent: ParsedContentResponse;
    readonly error: { readonly message: string } | null;
  } | null;
  readonly tooltip: string | null;
}

// ---------------------------------------------------------------------------
// Edge and conflict types (mirroring @norbert/config-explorer shapes)
// ---------------------------------------------------------------------------

export interface ConfigEdgeResponse {
  readonly sourceId: string;
  readonly targetId: string;
  readonly edgeType: string;
  readonly label: string;
}

export interface NamingConflictNodeRef {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly subsystem: string;
  readonly nodeType: string;
}

export interface NamingConflictResponse {
  readonly name: string;
  readonly nodeType: string;
  readonly higherScope: NamingConflictNodeRef;
  readonly lowerScope: NamingConflictNodeRef;
  readonly resolution: string;
}

// ---------------------------------------------------------------------------
// Full config model summary types
// ---------------------------------------------------------------------------

export interface ConfigModelResponse {
  readonly nodes: readonly {
    readonly id: string;
    readonly name: string;
    readonly scope: string;
    readonly subsystem: string;
    readonly nodeType: string;
    readonly filePath: string;
    readonly content: string;
    readonly parsedContent: ParsedContentResponse;
    readonly error: { readonly message: string } | null;
  }[];
  readonly edges: readonly ConfigEdgeResponse[];
  readonly conflicts: readonly NamingConflictResponse[];
  readonly totalFiles: number;
  readonly scopeSummary: Record<string, number>;
  readonly subsystemSummary: Record<string, number>;
}

export interface ConfigTreeResponse {
  readonly nodes: readonly ConfigTreeNode[];
  readonly scopes: {
    readonly user: { readonly found: boolean };
    readonly project: { readonly found: boolean };
  };
  readonly model?: ConfigModelResponse;
  readonly fileTrees?: Partial<Record<string, FileTreeNode>>;
}

// ---------------------------------------------------------------------------
// Cascade (precedence) response types
// ---------------------------------------------------------------------------

export interface CascadeNodeRef {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly subsystem: string;
  readonly filePath: string;
}

export interface CascadeEntry {
  readonly scope: string;
  readonly status: 'active' | 'overridden' | 'empty' | 'access-denied';
  readonly nodes: readonly CascadeNodeRef[];
  readonly overrideReason: string | null;
  readonly mergeContribution: readonly string[] | null;
}

export interface CascadeResponse {
  readonly subsystem: string;
  readonly entries: readonly CascadeEntry[];
  readonly resolutionType: 'override' | 'additive' | 'merge';
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

export const fetchConfigTree = async (
  baseUrl: string,
): Promise<ConfigTreeResponse> => {
  const response = await fetch(`${baseUrl}/api/config/tree`);
  if (!response.ok) {
    throw new Error(`Failed to fetch config tree: ${response.status}`);
  }
  return response.json() as Promise<ConfigTreeResponse>;
};

export const fetchCascade = async (
  baseUrl: string,
  subsystem: string,
): Promise<CascadeResponse> => {
  const response = await fetch(`${baseUrl}/api/config/cascade/${encodeURIComponent(subsystem)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch cascade for ${subsystem}: ${response.status}`);
  }
  return response.json() as Promise<CascadeResponse>;
};

// ---------------------------------------------------------------------------
// Path test response types
// ---------------------------------------------------------------------------

export interface PathTestRuleRef {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly subsystem: string;
  readonly filePath: string;
}

export interface PathTestMatchResult {
  readonly rule: PathTestRuleRef;
  readonly status: 'match' | 'no-match' | 'unconditional';
  readonly pattern: string | null;
  readonly reason: string;
}

export interface PathTestResponse {
  readonly testPath: string;
  readonly matches: readonly PathTestMatchResult[];
  readonly nonMatches: readonly PathTestMatchResult[];
  readonly unconditional: readonly PathTestMatchResult[];
}

// ---------------------------------------------------------------------------
// Path test fetch
// ---------------------------------------------------------------------------

export const fetchPathTest = async (
  baseUrl: string,
  filePath: string,
): Promise<PathTestResponse> => {
  const response = await fetch(
    `${baseUrl}/api/config/test-path?path=${encodeURIComponent(filePath)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to test path '${filePath}': ${response.status}`);
  }
  return response.json() as Promise<PathTestResponse>;
};

// ---------------------------------------------------------------------------
// Search response types
// ---------------------------------------------------------------------------

export interface SearchResultNodeRef {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly subsystem: string;
  readonly nodeType: string;
  readonly filePath: string;
  readonly content: string;
  readonly parsedContent: ParsedContentResponse;
  readonly error: { readonly message: string } | null;
}

export interface SearchResultResponse {
  readonly node: SearchResultNodeRef;
  readonly matchingLine: string;
  readonly lineNumber: number;
  readonly context: string;
}

// ---------------------------------------------------------------------------
// Search fetch
// ---------------------------------------------------------------------------

export const fetchConfigSearch = async (
  baseUrl: string,
  query: string,
): Promise<readonly SearchResultResponse[]> => {
  const response = await fetch(
    `${baseUrl}/api/config/search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to search config: ${response.status}`);
  }
  return response.json() as Promise<readonly SearchResultResponse[]>;
};
