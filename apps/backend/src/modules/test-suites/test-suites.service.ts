import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../config/supabase.module';
import { TestSuite, CreateTestSuiteDto } from '@qa/shared-types';

@Injectable()
export class TestSuitesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findByProject(projectId: string): Promise<TestSuite[]> {
    const { data, error } = await this.supabase
      .from('test_suites')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id: string): Promise<TestSuite> {
    const { data, error } = await this.supabase
      .from('test_suites')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Test suite not found');
    return data;
  }

  async create(
    projectId: string,
    dto: CreateTestSuiteDto,
    isAiGenerated = false,
  ): Promise<TestSuite> {
    const { data, error } = await this.supabase
      .from('test_suites')
      .insert({
        ...dto,
        project_id: projectId,
        is_ai_generated: isAiGenerated,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(
    id: string,
    dto: Partial<CreateTestSuiteDto>,
  ): Promise<TestSuite> {
    const { data, error } = await this.supabase
      .from('test_suites')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Test suite not found');
    return data;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('test_suites')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
