import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../config/supabase.module';
import { AppModule, CreateModuleDto, UpdateModuleDto } from '../../shared-types';

@Injectable()
export class ModulesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findByProject(projectId: string): Promise<AppModule[]> {
    const { data, error } = await this.supabase
      .from('app_modules')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id: string): Promise<AppModule & { test_suites: any[] }> {
    const { data, error } = await this.supabase
      .from('app_modules')
      .select('*, test_suites(*)')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Module not found');
    return data;
  }

  async create(projectId: string, dto: CreateModuleDto): Promise<AppModule> {
    const { data, error } = await this.supabase
      .from('app_modules')
      .insert({
        ...dto,
        project_id: projectId,
        discovered_urls: dto.discovered_urls || [],
        element_count: dto.element_count || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, dto: UpdateModuleDto): Promise<AppModule> {
    const { data, error } = await this.supabase
      .from('app_modules')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Module not found');
    return data;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('app_modules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
