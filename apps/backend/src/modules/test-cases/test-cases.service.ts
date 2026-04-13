import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../config/supabase.module';
import {
  TestCase,
  CreateTestCaseDto,
  UpdateTestCaseDto,
} from '@qa/shared-types';

@Injectable()
export class TestCasesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findByProject(
    projectId: string,
    filters?: { test_type?: string; status?: string },
  ): Promise<TestCase[]> {
    let query = this.supabase
      .from('test_cases')
      .select('*')
      .eq('project_id', projectId);

    if (filters?.test_type) {
      query = query.eq('test_type', filters.test_type);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) throw error;
    return data;
  }

  async findBySuite(suiteId: string): Promise<TestCase[]> {
    const { data, error } = await this.supabase
      .from('test_cases')
      .select('*')
      .eq('suite_id', suiteId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async findOne(id: string): Promise<TestCase> {
    const { data, error } = await this.supabase
      .from('test_cases')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException('Test case not found');
    return data;
  }

  async findByIds(ids: string[]): Promise<TestCase[]> {
    const { data, error } = await this.supabase
      .from('test_cases')
      .select('*')
      .in('id', ids);

    if (error) throw error;
    return data;
  }

  async create(
    projectId: string,
    dto: CreateTestCaseDto,
  ): Promise<TestCase> {
    const { data, error } = await this.supabase
      .from('test_cases')
      .insert({ ...dto, project_id: projectId })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(
    projectId: string,
    dtos: CreateTestCaseDto[],
  ): Promise<TestCase[]> {
    const records = dtos.map((dto) => ({ ...dto, project_id: projectId }));

    const { data, error } = await this.supabase
      .from('test_cases')
      .insert(records)
      .select();

    if (error) throw error;
    return data;
  }

  async update(id: string, dto: UpdateTestCaseDto): Promise<TestCase> {
    const { data, error } = await this.supabase
      .from('test_cases')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Test case not found');
    return data;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('test_cases')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
