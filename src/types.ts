// Azure DevOps API Types
export interface AzureDevOpsConfig {
  accessToken: string;
  collectionUri: string;
  teamProject: string;
  repositoryName: string;
  pullRequestId: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface PullRequestInfo {
  pullRequestId: number;
  repository: {
    id: string;
    name: string;
  };
  sourceRefName: string;
  targetRefName: string;
  title: string;
  description: string;
}

export interface PullRequestThread {
  id?: number;
  publishedDate?: string;
  lastUpdatedDate?: string;
  comments: PullRequestComment[];
  status: ThreadStatus;
  threadContext?: ThreadContext;
  pullRequestThreadContext?: PullRequestThreadContext;
}

export interface PullRequestComment {
  id?: number;
  content: string;
  commentType: CommentType;
  publishedDate?: string;
  lastUpdatedDate?: string;
}

export interface ThreadContext {
  filePath: string;
  leftFileStart?: FilePosition;
  leftFileEnd?: FilePosition;
  rightFileStart?: FilePosition;
  rightFileEnd?: FilePosition;
}

export interface FilePosition {
  line: number;
  offset: number;
  snippet?: string;
}

export interface PullRequestThreadContext {
  changeTrackingId: number;
  iterationContext: {
    firstComparingIteration: number;
    secondComparingIteration: number;
  };
}

export enum ThreadStatus {
  Unknown = 0,
  Active = 1,
  Fixed = 2,
  WontFix = 3,
  Closed = 4,
  ByDesign = 5,
  Pending = 6
}

export enum CommentType {
  Unknown = 0,
  Text = 1,
  CodeChange = 2,
  System = 3
}

// Claude Review Types
export interface ReviewRequest {
  filePath: string;
  diff: string;
  existingComments: PullRequestComment[];
}

export interface ReviewResponse {
  threads: ReviewThread[];
}

export interface ReviewThread {
  comments: ReviewComment[];
  status: number;
  threadContext: ReviewThreadContext;
}

export interface ReviewComment {
  content: string;
  commentType: number;
}

export interface ReviewThreadContext {
  filePath: string;
  leftFileStart?: ReviewFilePosition;
  leftFileEnd?: ReviewFilePosition;
  rightFileStart?: ReviewFilePosition;
  rightFileEnd?: ReviewFilePosition;
}

export interface ReviewFilePosition {
  line: number;
  offset: number;
  snippet?: string;
}

// Git Types
export interface GitDiffFile {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  diff: string;
  isBinary: boolean;
  size: number;
}

// Configuration Types
export interface FileFilterConfig {
  excludePatterns: string[];
  maxFileSize: number;
  includeBinary: boolean;
}

export interface ReviewConfig {
  maxTurns: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
}