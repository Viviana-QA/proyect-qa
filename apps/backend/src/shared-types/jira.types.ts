export interface JiraConfig {
  id: string;
  project_id: string;
  jira_base_url: string;
  jira_email: string;
  jira_api_token_encrypted: string;
  jira_project_key: string;
  issue_type: string;
  auto_create_on_failure: boolean;
  label_prefix: string;
  priority_mapping: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJiraConfigDto {
  jira_base_url: string;
  jira_email: string;
  jira_api_token: string;
  jira_project_key: string;
  issue_type?: string;
  auto_create_on_failure?: boolean;
  label_prefix?: string;
  priority_mapping?: Record<string, string>;
}

export interface UpdateJiraConfigDto {
  jira_base_url?: string;
  jira_email?: string;
  jira_api_token?: string;
  jira_project_key?: string;
  issue_type?: string;
  auto_create_on_failure?: boolean;
  label_prefix?: string;
  priority_mapping?: Record<string, string>;
}

export interface JiraIssuePayload {
  fields: {
    project: { key: string };
    summary: string;
    description: JiraDocument;
    issuetype: { name: string };
    priority?: { name: string };
    labels?: string[];
  };
}

export interface JiraDocument {
  type: 'doc';
  version: 1;
  content: JiraDocumentNode[];
}

export interface JiraDocumentNode {
  type: string;
  content?: { type: string; text?: string; attrs?: Record<string, unknown> }[];
  attrs?: Record<string, unknown>;
}
