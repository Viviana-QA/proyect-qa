import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../config/supabase.module';
import {
  JiraConfig,
  CreateJiraConfigDto,
  UpdateJiraConfigDto,
  JiraDocument,
} from '../../shared-types';
import * as crypto from 'crypto';

@Injectable()
export class JiraService {
  private readonly encryptionKey: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.getOrThrow('ENCRYPTION_KEY');
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(this.encryptionKey, 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(this.encryptionKey, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async getConfig(projectId: string): Promise<JiraConfig | null> {
    const { data, error } = await this.supabase
      .from('jira_configs')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw error;
    return data;
  }

  async saveConfig(
    projectId: string,
    dto: CreateJiraConfigDto,
  ): Promise<JiraConfig> {
    const encryptedToken = this.encrypt(dto.jira_api_token);

    const { data, error } = await this.supabase
      .from('jira_configs')
      .upsert(
        {
          project_id: projectId,
          jira_base_url: dto.jira_base_url,
          jira_email: dto.jira_email,
          jira_api_token_encrypted: encryptedToken,
          jira_project_key: dto.jira_project_key,
          issue_type: dto.issue_type || 'Bug',
          auto_create_on_failure: dto.auto_create_on_failure || false,
          label_prefix: dto.label_prefix || 'qa-auto',
          priority_mapping: dto.priority_mapping || null,
        },
        { onConflict: 'project_id' },
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async testConnection(
    baseUrl: string,
    email: string,
    apiToken: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
      const response = await fetch(`${baseUrl}/rest/api/3/myself`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const user = await response.json();
        return {
          success: true,
          message: `Connected as ${user.displayName}`,
        };
      }
      return {
        success: false,
        message: `Authentication failed: ${response.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection failed: ${err.message}`,
      };
    }
  }

  async getJiraProjects(
    baseUrl: string,
    email: string,
    apiToken: string,
  ): Promise<{ key: string; name: string; id: string }[]> {
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const response = await fetch(`${baseUrl}/rest/api/3/project`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Failed to fetch projects: ${response.status}`);
    const projects = await response.json();
    return projects.map((p: any) => ({ key: p.key, name: p.name, id: p.id }));
  }

  async createIssue(
    projectId: string,
    summary: string,
    description: string,
    testType: string,
    priority: string,
    screenshotUrls: string[] = [],
  ): Promise<{ issueKey: string; issueUrl: string }> {
    const config = await this.getConfig(projectId);
    if (!config) throw new NotFoundException('Jira not configured for this project');

    const apiToken = this.decrypt(config.jira_api_token_encrypted);
    const auth = Buffer.from(`${config.jira_email}:${apiToken}`).toString(
      'base64',
    );

    const jiraDescription: JiraDocument = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: description }],
        },
        ...(screenshotUrls.length
          ? [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: `Screenshots: ${screenshotUrls.join(', ')}`,
                  },
                ],
              },
            ]
          : []),
      ],
    };

    const priorityName =
      config.priority_mapping?.[priority] || 'Medium';

    const response = await fetch(
      `${config.jira_base_url}/rest/api/3/issue`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: { key: config.jira_project_key },
            summary: `[${config.label_prefix}] ${summary}`,
            description: jiraDescription,
            issuetype: { name: config.issue_type },
            priority: { name: priorityName },
            labels: [config.label_prefix, testType],
          },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    return {
      issueKey: result.key,
      issueUrl: `${config.jira_base_url}/browse/${result.key}`,
    };
  }
}
